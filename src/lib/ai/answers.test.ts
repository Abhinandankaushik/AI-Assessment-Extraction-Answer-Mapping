import { describe, expect, it } from "vitest";
import type { BBox } from "@/lib/types";
import { buildParts, resolvePage, unionBoxes, widen } from "./answers";

const box = (ymin: number, xmin: number, ymax: number, xmax: number) => ({
  ymin,
  xmin,
  ymax,
  xmax,
});

/** The values come out of float subtraction, so compare with tolerance rather
 *  than asserting exact equality on numbers like 0.040000000000000036. */
function expectBox(actual: BBox | null, expected: BBox) {
  expect(actual).not.toBeNull();
  expect(actual!.x).toBeCloseTo(expected.x, 6);
  expect(actual!.y).toBeCloseTo(expected.y, 6);
  expect(actual!.w).toBeCloseTo(expected.w, 6);
  expect(actual!.h).toBeCloseTo(expected.h, 6);
}

describe("unionBoxes", () => {
  it("wraps every line in one rect and normalises 0-1000 to 0-1", () => {
    expectBox(unionBoxes([box(100, 200, 140, 800), box(150, 200, 190, 600)], 0), {
      x: 0.2,
      y: 0.1,
      w: 0.6,
      h: 0.09,
    });
  });

  it("returns null when there is nothing to wrap", () => {
    expect(unionBoxes([])).toBeNull();
  });

  it("ignores degenerate boxes the model sometimes emits", () => {
    // A zero-width box would otherwise drag the union out to the page edge.
    expectBox(unionBoxes([box(100, 200, 140, 200), box(300, 400, 340, 900)], 0), {
      x: 0.4,
      y: 0.3,
      w: 0.5,
      h: 0.04,
    });
    expect(unionBoxes([box(100, 200, 100, 800)])).toBeNull();
  });

  it("pads the rect without letting it escape the page", () => {
    expectBox(unionBoxes([box(500, 500, 600, 600)], 0.01), {
      x: 0.49,
      y: 0.49,
      w: 0.12,
      h: 0.12,
    });
    expectBox(unionBoxes([box(0, 0, 1000, 1000)], 0.05), {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("reads a line the model reported upside down", () => {
    // Dropping it instead shortens the highlight by exactly that line.
    expectBox(unionBoxes([box(140, 800, 100, 200)], 0), {
      x: 0.2,
      y: 0.1,
      w: 0.6,
      h: 0.04,
    });
  });

  it("holds a coordinate that overshot the page to the page", () => {
    // One runaway value would otherwise stretch the band across everything.
    expectBox(unionBoxes([box(100, 200, 140, 4000), box(150, 200, 190, 600)], 0), {
      x: 0.2,
      y: 0.1,
      w: 0.8,
      h: 0.09,
    });
  });
});

describe("resolvePage", () => {
  it("takes a page number that is in the batch", () => {
    expect(resolvePage(15, [13, 14, 15, 16])).toBe(15);
  });

  it("reads a position in the batch as the page it points at", () => {
    // A model handed four images answers "which page?" with "3" as readily as
    // with "15". Both say the same thing, and both have to land on page 15.
    expect(resolvePage(3, [13, 14, 15, 16])).toBe(15);
  });

  it("falls back to the first page of the batch when it is neither", () => {
    expect(resolvePage(0, [13, 14, 15, 16])).toBe(13);
    expect(resolvePage(99, [13, 14, 15, 16])).toBe(13);
    expect(resolvePage(Number.NaN, [13, 14, 15, 16])).toBe(13);
  });

  it("prefers the real page number when a batch contains its own positions", () => {
    // The first batch is where position and page number coincide, which is why
    // a model reporting positions looks correct there and fails everywhere else.
    expect(resolvePage(3, [1, 2, 3, 4])).toBe(3);
  });
});


const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => box(100 + i * 40, 100, 130 + i * 40, 900));

describe("buildParts", () => {
  const TEXT = "(a) 2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O (b) NaCl + AgNO3 -> AgCl + NaNO3";

  it("gives each marked part the lines it actually covers", () => {
    const parts = buildParts(
      [
        { marker: "a", firstLine: 0 },
        { marker: "b", firstLine: 1 },
      ],
      rows(2),
      TEXT,
      10,
    );

    expect(parts.map((p) => p.marker)).toEqual(["a", "b"]);
    expect(parts[0].transcription).toBe("(a) 2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O");
    expect(parts[1].transcription).toBe("(b) NaCl + AgNO3 -> AgCl + NaNO3");
    // Part (b) must land on its own line, not the one above it.
    expectBox(parts[1].regions[0].box, {
      x: 0.092,
      y: 0.132,
      w: 0.816,
      h: 0.046,
    });
  });

  it("keeps a stem written above the first marker with that part", () => {
    const parts = buildParts(
      [
        { marker: "a", firstLine: 1 },
        { marker: "b", firstLine: 2 },
      ],
      rows(3),
      "Balanced equations: (a) first reaction (b) second reaction",
      1,
    );

    expect(parts[0].transcription).toBe("Balanced equations: (a) first reaction");
    expect(parts[0].regions[0].box.y).toBeCloseTo(0.092, 3);
  });

  it("carries the lines below a marker into its part", () => {
    const parts = buildParts(
      [
        { marker: "a", firstLine: 0 },
        { marker: "b", firstLine: 3 },
      ],
      rows(4),
      "(a) first, running over three lines (b) second",
      1,
    );

    expect(parts[0].regions[0].box.h).toBeCloseTo(0.126, 3);
    expect(parts[1].regions[0].box.h).toBeCloseTo(0.046, 3);
  });

  it.each([
    ["a single marker", [{ marker: "a", firstLine: 0 }]],
    ["no markers", []],
  ])("reports nothing for %s", (_label, raw) => {
    expect(buildParts(raw, rows(2), TEXT, 1)).toEqual([]);
  });

  it.each([
    ["line indices that go backwards", [
      { marker: "a", firstLine: 1 },
      { marker: "b", firstLine: 0 },
    ]],
    ["a line index past the last box", [
      { marker: "a", firstLine: 0 },
      { marker: "b", firstLine: 9 },
    ]],
    ["a marker missing from the transcription", [
      { marker: "a", firstLine: 0 },
      { marker: "c", firstLine: 1 },
    ]],
  ])("drops every part on %s", (_label, raw) => {
    // A mis-sliced part highlights the wrong lines, which is worse than not
    // splitting the answer at all.
    expect(buildParts(raw, rows(2), TEXT, 1)).toEqual([]);
  });
});

describe("widen", () => {
  const lines = { x: 0.1, y: 0.1, w: 0.7, h: 0.2 };

  it("takes in a last line the per-line boxes missed", () => {
    // The model reliably says where a whole answer sits; it is remembering a box
    // for the final line that it drops, which cut highlights short.
    expect(widen(lines, { x: 0.1, y: 0.1, w: 0.7, h: 0.26 })).toEqual({
      x: 0.1,
      y: 0.1,
      w: 0.7,
      h: 0.26,
    });
  });

  it("never lets a block box move the top or the sides", () => {
    // A box that drifted upward would drag the highlight over the answer above.
    expectBox(widen(lines, { x: 0, y: 0, w: 1, h: 0.32 }), { ...lines, h: 0.22 });
  });

  it("caps how far a block box may reach past the last line", () => {
    // Recovering a few missed lines is worth it; swallowing half the page is not.
    expectBox(widen(lines, { x: 0, y: 0, w: 1, h: 1 }), { ...lines, h: 0.32 });
  });

  it("falls back to whichever box it was given", () => {
    expect(widen(null, lines)).toEqual(lines);
    expect(widen(lines, null)).toEqual(lines);
    expect(widen(null, null)).toBeNull();
  });
});
