import { Type } from "@google/genai";
import type { AnswerBlock, AnswerPart, BBox } from "@/lib/types";
import { ThinkingLevel, generateJson, type ImagePart } from "./client";

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
  required: ["ymin", "xmin", "ymax", "xmax"],
} as const;

const PART = {
  type: Type.OBJECT,
  properties: {
    marker: { type: Type.STRING },
    firstLine: { type: Type.INTEGER },
  },
  required: ["marker", "firstLine"],
} as const;

/**
 * Field order matters here. The model transcribes the whole block first and
 * only then lays out the boxes, which is what keeps them aligned: asking for
 * text and geometry line by line made it emit each box against the line it had
 * just left, so every highlight sat one line too high and dropped its last line.
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
          parts: { type: Type.ARRAY, items: PART },
        },
        required: ["page", "transcription", "continuesFromPrevPage", "lineBoxes"],
      },
    },
  },
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
  parts?: RawPart[] | null;
}

function buildPrompt(pageNumbers: number[], totalPages: number): string {
  const list = pageNumbers.join(", ");
  return `
You are given ${pageNumbers.length} image(s) from one student's handwritten answer sheet.
In the order supplied, they are page ${list} of ${totalPages}.

Identify every distinct ANSWER BLOCK across these pages.

For each block report:
- "page": which page number it appears on, taken from the list above.
- "labelOnSheet": the question number the student wrote next to the answer, copied verbatim and IN FULL. Include any sub-part letter belonging to the label even when it sits on the next line or in brackets — write "Q.24) (b)" rather than just "Q.24)", and "Q 22 (a)" rather than "Q 22". Use null only when the student wrote no number at all.
- "transcription": the handwriting transcribed as accurately as you can. Describe drawings in square brackets, e.g. "[labelled diagram of a nephron]". Keep chemical formulae and equations readable as plain text. Keep any sub-part marker the student wrote at the start of a line, such as "(a)" or "(b)".
- "continuesFromPrevPage": true ONLY when the block has no label of its own and continues an answer that began on an earlier page.
- "lineBoxes": one tight bounding box per written LINE of this block, in the order written.
- "parts": include this ONLY when the student split this one answer into marked sub-parts such as "(a)" and "(b)", or "(i)" and "(ii)". Give one entry per marker: "marker" is the letter or numeral alone ("a", "b", "ii"), and "firstLine" is the 0-based index into "lineBoxes" of the line that marker starts on. Omit the field entirely when the answer has no such markers.

Bounding boxes use integers from 0 to 1000, normalised to the page image the block is on,
where (xmin, ymin) is the top-left corner and (xmax, ymax) the bottom-right corner.

Rules for "lineBoxes" — these decide whether the answer is highlighted correctly:
- Return one box for EVERY line you transcribed, first to last. An answer that ends with a result, a final step or a one-line conclusion must have a box for that line too.
- The FIRST box must reach left far enough to include the question number the student wrote beside the answer, so the number is highlighted along with the answer it belongs to.
- Boxes must wrap the handwriting tightly. Never return a box covering the whole page.
- Check the last line before you finish: if the block's transcription ends with a line that has no box, add it.

Other rules:
- Group consecutive lines belonging to the same answer into ONE block. Do not emit one block per line.
- Ignore printed ruled lines, margin rules, page numbers, QR codes, invigilator marks and the printed booklet header.
- Section headings such as "Section-A" are not answers. Skip them.
- Transcribe only what is written. If a page is blank, emit nothing for it.
`.trim();
}

const CLAMP = (n: number) => Math.min(1, Math.max(0, n));

/** Collapses the per-line boxes into the single tight rectangle the UI draws. */
export function unionBoxes(boxes: RawBox[], padding = 0.008): BBox | null {
  const valid = boxes.filter(
    (b) =>
      Number.isFinite(b.xmin) &&
      Number.isFinite(b.ymin) &&
      b.xmax > b.xmin &&
      b.ymax > b.ymin,
  );
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
    const box = unionBoxes(lineBoxes.slice(fromLine, to));
    if (!box || !text) return [];

    parts.push({ marker: part.marker, transcription: text, regions: [{ page, box }] });
    cursor = at + 1;
  }

  return parts;
}

export async function extractAnswersFromPages(
  images: ImagePart[],
  pageNumbers: number[],
  totalPages: number,
): Promise<AnswerBlock[]> {
  const result = await generateJson<{ blocks: RawBlock[] }>({
    system: SYSTEM,
    prompt: buildPrompt(pageNumbers, totalPages),
    images,
    schema: SCHEMA,
    thinking: ThinkingLevel.LOW,
  });

  const allowed = new Set(pageNumbers);

  return (result.blocks ?? [])
    .map((block, index) => {
      const lineBoxes = block.lineBoxes ?? [];
      const box = unionBoxes(lineBoxes);
      const transcription = block.transcription?.trim() ?? "";
      if (!box || !transcription) return null;

      const page = allowed.has(block.page) ? block.page : pageNumbers[0];
      const label = block.labelOnSheet?.trim();
      const parts = buildParts(block.parts, lineBoxes, transcription, page);

      return {
        id: `p${page}b${index + 1}`,
        labelOnSheet: label ? label : null,
        transcription,
        regions: [{ page, box }],
        continuesFromPrevPage: Boolean(block.continuesFromPrevPage),
        ...(parts.length > 1 ? { parts } : {}),
      } satisfies AnswerBlock;
    })
    .filter((b): b is AnswerBlock => b !== null)
    .sort(
      (a, b) =>
        a.regions[0].page - b.regions[0].page ||
        a.regions[0].box.y - b.regions[0].box.y,
    );
}
