import { Type } from "@google/genai";
import type { AnswerBlock, AnswerPart, BBox } from "@/lib/types";
import {
  ResponseTruncatedError,
  ThinkingLevel,
  generateJson,
  type ImagePart,
} from "./client";
import { leadingLabel } from "./numbering";

const SYSTEM =
  "You read scanned handwritten student answer sheets. You transcribe what is " +
  "actually written and you locate it precisely on the page. You never invent answers.";

/** Free-tier quota is counted per request, so several pages ride along in one
 *  call rather than one call per page. */
export const PAGES_PER_REQUEST = 4;

const BOX = {
  type: Type.OBJECT,
  properties: {
    ymin: { type: Type.INTEGER },
    xmin: { type: Type.INTEGER },
    ymax: { type: Type.INTEGER },
    xmax: { type: Type.INTEGER },
  },
  propertyOrdering: ["ymin", "xmin", "ymax", "xmax"],
  required: ["ymin", "xmin", "ymax", "xmax"],
} as const;

const PART = {
  type: Type.OBJECT,
  properties: {
    marker: { type: Type.STRING },
    firstLine: { type: Type.INTEGER },
  },
  propertyOrdering: ["marker", "firstLine"],
  required: ["marker", "firstLine"],
} as const;

/**
 * Field order matters here. The model transcribes the whole block first and
 * only then lays out the boxes, which is what keeps them aligned: asking for
 * text and geometry line by line made it emit each box against the line it had
 * just left, so every highlight sat one line too high and dropped its last line.
 *
 * "propertyOrdering" is what actually enforces that. The order of a schema's
 * "properties" map carries no such promise across the wire, so the ordering the
 * comment above describes was documented but never binding, and the model was
 * free to lay out geometry before it had transcribed anything — which is
 * exactly the failure the ordering exists to prevent.
 */
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.INTEGER },
          labelOnSheet: { type: Type.STRING, nullable: true },
          transcription: { type: Type.STRING },
          continuesFromPrevPage: { type: Type.BOOLEAN },
          lineBoxes: { type: Type.ARRAY, items: BOX },
          blockBox: BOX,
          parts: { type: Type.ARRAY, items: PART },
        },
        propertyOrdering: [
          "page",
          "labelOnSheet",
          "transcription",
          "continuesFromPrevPage",
          "lineBoxes",
          "blockBox",
          "parts",
        ],
        required: ["page", "transcription", "continuesFromPrevPage", "lineBoxes"],
      },
    },
  },
  propertyOrdering: ["blocks"],
  required: ["blocks"],
} as const;

export interface RawBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface RawPart {
  marker: string;
  firstLine: number;
}

interface RawBlock {
  page: number;
  labelOnSheet?: string | null;
  transcription: string;
  continuesFromPrevPage: boolean;
  lineBoxes: RawBox[];
  blockBox?: RawBox | null;
  parts?: RawPart[] | null;
}

function buildPrompt(pageNumbers: number[], totalPages: number): string {
  const list = pageNumbers.join(", ");
  return `
You are given ${pageNumbers.length} image(s) from one student's handwritten answer sheet.
They are page ${list} of ${totalPages}, and each image is captioned with its page number on the line directly above it.

Identify every distinct ANSWER BLOCK across these pages.

For each block report:
- "page": the number captioned above the image this block appears in. Read it off that caption. Do not count images, and do not infer the page from what the answer says or from which question you expect to come next — consecutive pages of the same ruled notebook look alike, and a block filed against the wrong one is drawn over somebody else's work.
- "labelOnSheet": the question number the student wrote next to the answer, copied verbatim and IN FULL. Include any sub-part letter belonging to the label even when it sits on the next line or in brackets — write "Q.24) (b)" rather than just "Q.24)", and "Q 22 (a)" rather than "Q 22". Use null only when the student wrote no number at all.
- "transcription": the handwriting transcribed as accurately as you can. Describe drawings in square brackets, e.g. "[labelled diagram of a nephron]". Keep chemical formulae and equations readable as plain text. Keep any sub-part marker the student wrote at the start of a line, such as "(a)" or "(b)".
- "continuesFromPrevPage": true ONLY when the block has no label of its own and continues an answer that began on an earlier page.
- "lineBoxes": one tight bounding box per written LINE of this block, in the order written.
- "blockBox": ONE box around the whole block, from the top of its first line to the bottom of its last. Give this for every block.
- "parts": include this ONLY when the student split this one answer into marked sub-parts such as "(a)" and "(b)", or "(i)" and "(ii)". Give one entry per marker: "marker" is the letter or numeral alone ("a", "b", "ii"), and "firstLine" is the 0-based index into "lineBoxes" of the line that marker starts on. Omit the field entirely when the answer has no such markers.

Bounding boxes use integers from 0 to 1000, normalised to the page image the block is on,
where (xmin, ymin) is the top-left corner and (xmax, ymax) the bottom-right corner.

Rules for "lineBoxes" — these decide whether the answer is highlighted correctly:
- Write the fields in the order listed above. Transcribe the block in full BEFORE you place a single box, then go back over the lines you transcribed and box each one. Boxing as you read makes every box land on the line above the words it belongs to.
- Return one box for EVERY line you transcribed, first to last. An answer that ends with a result, a final step or a one-line conclusion must have a box for that line too.
- A box belongs to the line it wraps. Before you finish, re-read your first box against the first line of your transcription: "ymin" must sit at the TOP of that handwriting, not on the line above it and not in the printed header.
- The FIRST box must reach left far enough to include the question number the student wrote beside the answer, so the number is highlighted along with the answer it belongs to.
- Boxes must wrap the handwriting tightly. Never return a box covering the whole page.
- Check the last line before you finish: if the block's transcription ends with a line that has no box, add it.
- "blockBox" must reach the bottom of the last written line. It is the answer to "where does this whole answer sit", and it is what catches a line the list above missed.

Other rules:
- Group consecutive lines belonging to the same answer into ONE block. Do not emit one block per line.
- A question number the student wrote ALWAYS ends the block above it and starts a new one, however little of the page separates them. A block whose transcription contains "Q.23)" anywhere but the very start is two answers run together, and the second one is then lost: split it.
- Ignore printed ruled lines, margin rules, page numbers, QR codes, invigilator marks and the printed booklet header.
- Section headings such as "Section-A" are not answers. Skip them.
- Transcribe only what is written. If a page is blank, emit nothing for it.
`.trim();
}

const CLAMP = (n: number) => Math.min(1, Math.max(0, n));

/** Coordinates are promised as 0-1000, and a model that overshoots or reverses
 *  a pair should cost that box its own geometry, not the whole block's: a
 *  dropped line box shortens the highlight, and a runaway one stretches it
 *  across the page. */
function normalise(box: RawBox): RawBox | null {
  const values = [box.ymin, box.xmin, box.ymax, box.xmax].map(Number);
  if (values.some((n) => !Number.isFinite(n))) return null;
  const [ymin, xmin, ymax, xmax] = values.map((n) => Math.min(1000, Math.max(0, n)));
  return {
    ymin: Math.min(ymin, ymax),
    xmin: Math.min(xmin, xmax),
    ymax: Math.max(ymin, ymax),
    xmax: Math.max(xmin, xmax),
  };
}

/** Collapses the per-line boxes into the single tight rectangle the UI draws. */
export function unionBoxes(boxes: RawBox[], padding = 0.008): BBox | null {
  const valid = boxes
    .map(normalise)
    .filter((b): b is RawBox => b !== null && b.xmax > b.xmin && b.ymax > b.ymin);
  if (valid.length === 0) return null;

  const xmin = Math.min(...valid.map((b) => b.xmin)) / 1000;
  const ymin = Math.min(...valid.map((b) => b.ymin)) / 1000;
  const xmax = Math.max(...valid.map((b) => b.xmax)) / 1000;
  const ymax = Math.max(...valid.map((b) => b.ymax)) / 1000;

  const x = CLAMP(xmin - padding);
  const y = CLAMP(ymin - padding);
  return {
    x,
    y,
    w: CLAMP(xmax + padding) - x,
    h: CLAMP(ymax + padding) - y,
  };
}

/** The furthest a block box may push a highlight past its last line box, as a
 *  fraction of page height — about four written lines. */
const REACH = 0.12;

/**
 * Widens the union of the line boxes down to the block box the model also
 * reported.
 *
 * The two are asked for independently, and the model is markedly better at
 * "where does this answer sit" than at remembering to emit a box for the final
 * line — which is how a highlight came to stop two lines short of the answer it
 * was pointing at.
 *
 * Only the bottom edge moves. The line boxes decide where an answer starts, and
 * a block box that has drifted upward would drag the highlight over whatever was
 * written above — someone else's answer. The reach is capped for the same
 * reason: recovering a few missed lines is worth it, swallowing half the page
 * is not.
 */
export function widen(lines: BBox | null, block: BBox | null): BBox | null {
  if (!lines) return block;
  if (!block) return lines;

  const bottom = Math.min(
    Math.max(lines.y + lines.h, block.y + block.h),
    lines.y + lines.h + REACH,
    1,
  );
  return { ...lines, h: bottom - lines.y };
}

/** Where a sub-part marker sits in the block's own transcription, searched
 *  forwards so "(b)" is found after "(a)" rather than anywhere on the line. */
function markerAt(text: string, marker: string, from: number): number {
  const pattern = new RegExp(`\\(\\s*${marker}\\s*\\)|(?:^|\\s)${marker}\\s*\\)`, "i");
  const found = text.slice(from).search(pattern);
  return found === -1 ? -1 : from + found;
}

/**
 * Turns the markers the model reported into parts with their own text and
 * geometry. Whether these ever become separate blocks is decided later against
 * the question paper — see materialiseParts.
 *
 * Anything inconsistent drops the parts altogether rather than guessing: a
 * mis-sliced part would highlight the wrong lines, which is worse than not
 * splitting at all.
 */
export function buildParts(
  raw: RawPart[] | null | undefined,
  lineBoxes: RawBox[],
  transcription: string,
  page: number,
  blockBox: BBox | null = null,
): AnswerPart[] {
  const cleaned = (raw ?? []).map((part) => ({
    marker: String(part?.marker ?? "")
      .toLowerCase()
      .replace(/[^a-z]/g, ""),
    firstLine: Number(part?.firstLine),
  }));

  if (cleaned.length < 2) return [];
  if (
    cleaned.some(
      (part, i) =>
        !part.marker ||
        !Number.isInteger(part.firstLine) ||
        part.firstLine < 0 ||
        part.firstLine >= lineBoxes.length ||
        (i > 0 && part.firstLine <= cleaned[i - 1].firstLine),
    )
  ) {
    return [];
  }

  const parts: AnswerPart[] = [];
  let cursor = 0;

  for (const [i, part] of cleaned.entries()) {
    const at = markerAt(transcription, part.marker, cursor);
    if (at === -1) return [];

    // The first part keeps whatever stem was written above its marker — in its
    // box as well as its text, or the highlight would start below the words it
    // is showing.
    const from = i === 0 ? 0 : at;
    const fromLine = i === 0 ? 0 : part.firstLine;
    const nextMarker =
      i + 1 < cleaned.length
        ? markerAt(transcription, cleaned[i + 1].marker, at + 1)
        : -1;
    const text = transcription
      .slice(from, nextMarker === -1 ? undefined : nextMarker)
      .trim();

    const to = cleaned[i + 1]?.firstLine ?? lineBoxes.length;
    const lines = unionBoxes(lineBoxes.slice(fromLine, to));
    // Only the closing part can be short at the bottom, so only it is widened.
    const last = i === cleaned.length - 1;
    const box = last ? widen(lines, blockBox) : lines;
    if (!box || !text) return [];

    parts.push({ marker: part.marker, transcription: text, regions: [{ page, box }] });
    cursor = at + 1;
  }

  return parts;
}

/**
 * Which page of the whole sheet a block was reported on.
 *
 * Pages ride in batches, so the fourth batch is told it is showing pages 13-16
 * — and a model handed four images answers "which page is this?" with "3" about
 * as readily as with "15". Both are usable: a number outside the batch that
 * indexes into it is read as the position it plainly is. Only a number that is
 * neither falls back, and it falls back to the batch's first page because a
 * block has to be drawn somewhere.
 *
 * The distinction matters more than it looks. The first batch is pages 1-4,
 * where position and page number are the same, so a model reporting positions
 * looks perfectly correct there and silently piles every later batch onto one
 * page.
 */
export function resolvePage(reported: number, pageNumbers: number[]): number {
  const page = Math.trunc(Number(reported));
  if (pageNumbers.includes(page)) return page;
  if (page >= 1 && page <= pageNumbers.length) return pageNumbers[page - 1];
  return pageNumbers[0];
}

const byReadingOrder = (a: AnswerBlock, b: AnswerBlock) =>
  a.regions[0].page - b.regions[0].page || a.regions[0].box.y - b.regions[0].box.y;

/**
 * Pages ride together to save quota, but a batch of dense handwriting can want
 * more room than one reply has. When that happens the batch is halved and each
 * half asked separately — a couple more requests, against a run that would
 * otherwise fail outright.
 */
export async function extractAnswersFromPages(
  images: ImagePart[],
  pageNumbers: number[],
  totalPages: number,
): Promise<AnswerBlock[]> {
  try {
    return await readBatch(images, pageNumbers, totalPages);
  } catch (error) {
    if (!(error instanceof ResponseTruncatedError) || images.length < 2) throw error;

    const half = Math.ceil(images.length / 2);
    const first = await extractAnswersFromPages(
      images.slice(0, half),
      pageNumbers.slice(0, half),
      totalPages,
    );
    const second = await extractAnswersFromPages(
      images.slice(half),
      pageNumbers.slice(half),
      totalPages,
    );
    return [...first, ...second].sort(byReadingOrder);
  }
}

async function readBatch(
  images: ImagePart[],
  pageNumbers: number[],
  totalPages: number,
): Promise<AnswerBlock[]> {
  const result = await generateJson<{ blocks: RawBlock[] }>({
    system: SYSTEM,
    prompt: buildPrompt(pageNumbers, totalPages),
    images: images.map((image, index) => ({
      ...image,
      label: `=== PAGE ${pageNumbers[index] ?? index + 1} of ${totalPages} ===`,
    })),
    schema: SCHEMA,
    // Locating handwriting is perception, not deliberation, so this sat at LOW
    // to match the rest of the reads. It was costing accuracy: on a page of
    // worked algebra with wide gaps between steps, LOW put the box for "Q.22)
    // (a) Lamp A -> Power = 50W" five lines above the words, over the tail of
    // the answer before it. MEDIUM lands it on the handwriting, tightens the
    // boxes that were dropping their last line, and on the sample batch did not
    // cost wall clock at all.
    thinking: ThinkingLevel.MEDIUM,
  });

  return (result.blocks ?? [])
    .map((block, index) => {
      const lineBoxes = block.lineBoxes ?? [];
      const blockBox = block.blockBox ? unionBoxes([block.blockBox]) : null;
      const box = widen(unionBoxes(lineBoxes), blockBox);
      const transcription = block.transcription?.trim() ?? "";
      if (!box || !transcription) return null;

      const page = resolvePage(block.page, pageNumbers);
      // Read out of the transcription first: the number and the words came
      // back together, so they cannot belong to different answers. The model's
      // own field is kept as a second reading for the mapper, because either
      // can be a misread — a sheet saying "Q.24) (b)" came back transcribed
      // "Q.24) (i)", which addresses a sub-part the paper does not print.
      // A label the student wrote over two lines comes back with the newline in
      // it, and it is shown on the highlight tag as well as matched on.
      const reported = block.labelOnSheet?.replace(/\s+/g, " ").trim() || null;
      const label = leadingLabel(transcription) ?? reported;
      const parts = buildParts(
        block.parts,
        lineBoxes,
        transcription,
        page,
        blockBox,
      );

      return {
        id: `p${page}b${index + 1}`,
        labelOnSheet: label ? label : null,
        ...(reported && reported !== label ? { labelReported: reported } : {}),
        transcription,
        regions: [{ page, box }],
        continuesFromPrevPage: Boolean(block.continuesFromPrevPage),
        ...(parts.length > 1 ? { parts } : {}),
      } satisfies AnswerBlock;
    })
    .filter((b): b is AnswerBlock => b !== null)
    .sort(byReadingOrder);
}
