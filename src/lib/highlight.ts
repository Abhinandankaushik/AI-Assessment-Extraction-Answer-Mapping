import type { AnswerBlock, AnswerRegion } from "./types";

/** Kept clear of the page edge so a band never runs into the margin rule. */
const EDGE = 0.02;

/** How far a band may be stretched past the boxes the model returned, as a
 *  fraction of page height — about two written lines. */
const REACH = 0.05;

/** Breathing room left above whatever is written next. */
const CLEARANCE = 0.008;

/**
 * The column the student wrote in, taken from every answer located on the sheet.
 *
 * The model boxes each line as tightly as it can, so a highlight built straight
 * from those boxes ends where that particular answer's longest line ends — one
 * answer's band stops mid-page, the next reaches the margin, and the ragged
 * right edge reads as though the wrong text were picked out. Every band is drawn
 * to the same column instead, which is what a teacher's marker would do.
 */
export function writingColumn(blocks: AnswerBlock[]): { x: number; w: number } | null {
  let left = Infinity;
  let right = -Infinity;

  for (const block of blocks) {
    for (const region of block.regions) {
      left = Math.min(left, region.box.x);
      right = Math.max(right, region.box.x + region.box.w);
    }
  }
  if (left > right) return null;

  const x = Math.max(EDGE, left);
  return { x, w: Math.min(1 - EDGE, right) - x };
}

/**
 * The top of the next thing written under `region` on its page.
 *
 * Measured from where the region starts rather than where it ends, so a
 * neighbour the model boxed as slightly overlapping still holds the band back.
 */
function nextTopBelow(blocks: AnswerBlock[], region: AnswerRegion): number {
  let next = 1;

  for (const block of blocks) {
    for (const other of block.regions) {
      if (other.page !== region.page || other === region) continue;
      if (other.box.y > region.box.y) next = Math.min(next, other.box.y);
    }
  }
  return next;
}

/**
 * Turns the regions the model located into the bands the viewer draws.
 *
 * Two corrections, both presentational — the extracted geometry stays as it was
 * measured, because the mapping reasons about it. Every band is drawn to the
 * common writing column, and its foot is allowed to fall a little further than
 * the boxes reached, since the model reliably drops a box for the last line or
 * two of an answer. That stretch stops short of whatever is written next, so a
 * band can never grow far enough to cover somebody else's answer.
 */
export function highlightBands(
  blocks: AnswerBlock[],
  regions: AnswerRegion[],
): AnswerRegion[] {
  const column = writingColumn(blocks);

  return regions.map((region) => {
    const bottom = region.box.y + region.box.h;
    const limit = Math.min(
      bottom + REACH,
      nextTopBelow(blocks, region) - CLEARANCE,
      1,
    );
    return {
      page: region.page,
      box: {
        x: column?.x ?? region.box.x,
        y: region.box.y,
        w: column?.w ?? region.box.w,
        h: Math.max(bottom, limit) - region.box.y,
      },
    };
  });
}
