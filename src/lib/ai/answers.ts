import { Type } from "@google/genai";
import type { AnswerBlock, BBox } from "@/lib/types";
import { ThinkingLevel, generateJson, type ImagePart } from "./client";
import { leadingSubPart } from "./numbering";

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

const LINE = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    box: BOX,
  },
  required: ["text", "box"],
} as const;

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
          continuesFromPrevPage: { type: Type.BOOLEAN },
          lines: { type: Type.ARRAY, items: LINE },
        },
        required: ["page", "continuesFromPrevPage", "lines"],
      },
    },
  },
  required: ["blocks"],
} as const;

interface RawBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface RawLine {
  text: string;
  box: RawBox;
}

interface RawBlock {
  page: number;
  labelOnSheet?: string | null;
  continuesFromPrevPage: boolean;
  lines: RawLine[];
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
- "continuesFromPrevPage": true ONLY when the block has no label of its own and continues an answer that began on an earlier page.
- "lines": one entry per written LINE of this answer, in the order written, each with:
  - "text": that line transcribed as accurately as you can. Keep any sub-part marker the student wrote at the start of a line, such as "(a)" or "(b)". Describe drawings in square brackets, e.g. "[labelled diagram of a nephron]". Keep chemical formulae and equations readable as plain text.
  - "box": a tight bounding box around that one line.

Bounding boxes use integers from 0 to 1000, normalised to the page image the block is on,
where (xmin, ymin) is the top-left corner and (xmax, ymax) the bottom-right corner.

Rules:
- Group consecutive lines belonging to the same answer into ONE block, one entry per line inside it.
- Boxes must wrap the handwriting tightly. Never return a box covering the whole page.
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

export interface AnswerPart {
  marker: string | null;
  lines: RawLine[];
}

/**
 * A student who answers "26 (a)" and "26 (b)" under one written number gives us
 * one block covering both. Splitting it at the markers is what lets each part
 * be highlighted — and marked — on its own.
 *
 * Only a block carrying two or more markers is split: a single leading "(a)" is
 * just how that one answer starts, not evidence of a group.
 */
export function splitIntoParts(lines: RawLine[]): AnswerPart[] {
  const parts: AnswerPart[] = [];

  for (const line of lines) {
    const marker = leadingSubPart(line.text);
    const last = parts[parts.length - 1];
    if (marker && marker !== last?.marker) parts.push({ marker, lines: [line] });
    else if (last) last.lines.push(line);
    else parts.push({ marker: null, lines: [line] });
  }

  if (parts.filter((p) => p.marker).length < 2) return [{ marker: null, lines }];

  // A shared stem written above the markers belongs with the first part.
  if (parts[0].marker === null && parts.length > 1) {
    parts[1].lines = [...parts[0].lines, ...parts[1].lines];
    parts.shift();
  }
  return parts;
}

function joinLines(lines: RawLine[]): string {
  return lines
    .map((l) => l.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
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
    .flatMap((block, index) => {
      const lines = block.lines ?? [];
      const page = allowed.has(block.page) ? block.page : pageNumbers[0];
      const label = block.labelOnSheet?.trim();
      const groupId = `p${page}b${index + 1}`;
      const parts = splitIntoParts(lines);

      return parts
        .map((part, partIndex) => {
          const box = unionBoxes(part.lines.map((l) => l.box));
          const transcription = joinLines(part.lines);
          if (!box || !transcription) return null;
          return {
            // Only the first part inherits the number the student wrote; the
            // rest carry the marker they were written with.
            id: parts.length > 1 ? `${groupId}_${partIndex + 1}` : groupId,
            labelOnSheet:
              (partIndex === 0 && label) ||
              (part.marker ? `(${part.marker})` : null),
            transcription,
            regions: [{ page, box }],
            continuesFromPrevPage:
              partIndex === 0 && Boolean(block.continuesFromPrevPage),
            ...(parts.length > 1
              ? { groupId, partMarker: part.marker }
              : {}),
          } satisfies AnswerBlock;
        })
        .filter((b): b is AnswerBlock => b !== null);
    })
    .sort(
      (a, b) =>
        a.regions[0].page - b.regions[0].page ||
        a.regions[0].box.y - b.regions[0].box.y,
    );
}
