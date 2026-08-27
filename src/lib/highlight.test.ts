import { describe, expect, it } from "vitest";
import type { AnswerBlock, AnswerRegion } from "./types";
import { highlightBands, writingColumn } from "./highlight";

const region = (page: number, y: number, h: number, x = 0.1, w = 0.5) => ({
  page,
  box: { x, y, w, h },
});

const block = (id: string, ...regions: AnswerRegion[]): AnswerBlock => ({
  id,
  labelOnSheet: null,
  transcription: `answer ${id}`,
  regions,
  continuesFromPrevPage: false,
});

describe("writingColumn", () => {
  it("spans every answer located on the sheet", () => {
    const column = writingColumn([
      block("b1", region(1, 0.1, 0.1, 0.12, 0.4)),
      block("b2", region(2, 0.2, 0.1, 0.09, 0.72)),
    ]);

    expect(column).toEqual({ x: 0.09, w: 0.72 });
  });

  it("keeps clear of the page edge", () => {
    const column = writingColumn([block("b1", region(1, 0.1, 0.1, 0, 1))]);
    expect(column).toEqual({ x: 0.02, w: 0.96 });
  });

  it("has nothing to say about a sheet with no answers on it", () => {
    expect(writingColumn([])).toBeNull();
    expect(writingColumn([block("b1")])).toBeNull();
  });
});

describe("highlightBands", () => {
  const sheet = [
    block("b1", region(1, 0.10, 0.10, 0.12, 0.40)),
    block("b2", region(1, 0.60, 0.10, 0.10, 0.70)),
  ];

  it("draws every band to the same column, whatever the answer's own width", () => {
    // A band that stops where one answer's longest line stops reads as though
    // the wrong text had been picked out.
    const [narrow] = highlightBands(sheet, sheet[0].regions);
    const [wide] = highlightBands(sheet, sheet[1].regions);

    expect(narrow.box.x).toBeCloseTo(0.1, 6);
    expect(narrow.box.w).toBeCloseTo(0.7, 6);
    expect(wide.box.x).toBeCloseTo(narrow.box.x, 6);
    expect(wide.box.w).toBeCloseTo(narrow.box.w, 6);
  });

  it("reaches past the boxes to the lines the model forgot", () => {
    const [band] = highlightBands(sheet, sheet[1].regions);
    // Nothing is written below it, so it takes the full reach.
    expect(band.box.y).toBeCloseTo(0.6, 6);
    expect(band.box.h).toBeCloseTo(0.15, 6);
  });

  it("stops short of whatever is written next", () => {
    // b1 ends at 0.20 and b2 starts at 0.60, so the reach is free; move b2 up
    // and the band must give way rather than cover it.
    const tight = [
      sheet[0],
      block("b2", region(1, 0.23, 0.10, 0.10, 0.70)),
    ];
    const [band] = highlightBands(tight, tight[0].regions);

    expect(band.box.y + band.box.h).toBeCloseTo(0.222, 6);
  });

  it("never shrinks a band that already covers its answer", () => {
    const crowded = [
      block("b1", region(1, 0.1, 0.2)),
      block("b2", region(1, 0.28, 0.1)),
    ];
    const [band] = highlightBands(crowded, crowded[0].regions);

    expect(band.box.y + band.box.h).toBeCloseTo(0.3, 6);
  });

  it("leaves the page a region belongs to alone", () => {
    const [band] = highlightBands(sheet, [region(2, 0.4, 0.1)]);
    expect(band.page).toBe(2);
  });
});
