import { Type } from "@google/genai";
import type { AnswerBlock, BBox } from "@/lib/types";
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
        },
        required: ["page", "transcription", "continuesFromPrevPage", "lineBoxes"],
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

interface RawBlock {
  page: number;
  labelOnSheet?: string | null;
  transcription: string;
  continuesFromPrevPage: boolean;
  lineBoxes: RawBox[];
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
- "transcription": the handwriting transcribed as accurately as you can. Describe drawings in square brackets, e.g. "[labelled diagram of a nephron]". Keep chemical formulae and equations readable as plain text.
- "continuesFromPrevPage": true ONLY when the block has no label of its own and continues an answer that began on an earlier page.
- "lineBoxes": one tight bounding box per written LINE of this answer.

Bounding boxes use integers from 0 to 1000, normalised to the page image the block is on,
where (xmin, ymin) is the top-left corner and (xmax, ymax) the bottom-right corner.

Rules:
- Group consecutive lines belonging to the same answer into ONE block. Do not emit one block per line.
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
      const box = unionBoxes(block.lineBoxes ?? []);
      if (!box) return null;
      const page = allowed.has(block.page) ? block.page : pageNumbers[0];
      const label = block.labelOnSheet?.trim();
      return {
        id: `p${page}b${index + 1}`,
        labelOnSheet: label ? label : null,
        transcription: block.transcription.trim(),
        regions: [{ page, box }],
        continuesFromPrevPage: Boolean(block.continuesFromPrevPage),
      } satisfies AnswerBlock;
    })
    .filter((b): b is AnswerBlock => b !== null)
    .sort(
      (a, b) =>
        a.regions[0].page - b.regions[0].page ||
        a.regions[0].box.y - b.regions[0].box.y,
    );
}
