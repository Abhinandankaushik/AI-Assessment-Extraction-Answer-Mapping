import { describe, expect, it } from "vitest";
import type { BBox } from "@/lib/types";
import { unionBoxes } from "./answers";

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
});
