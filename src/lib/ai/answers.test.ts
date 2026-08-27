import { describe, expect, it } from "vitest";
import type { BBox } from "@/lib/types";
import { splitIntoParts, unionBoxes } from "./answers";

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

const line = (text: string, ymin: number) => ({
  text,
  box: { ymin, xmin: 100, ymax: ymin + 30, xmax: 900 },
});

describe("splitIntoParts", () => {
  it("splits one written answer at its sub-part markers", () => {
    const parts = splitIntoParts([
      line("(a) 2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O", 100),
      line("(b) NaCl + AgNO3 -> AgCl + NaNO3", 140),
    ]);

    expect(parts.map((p) => p.marker)).toEqual(["a", "b"]);
    expect(parts[0].lines).toHaveLength(1);
    // Each part keeps its own lines, so each gets its own tight box.
    expectBox(unionBoxes(parts[1].lines.map((l) => l.box), 0), {
      x: 0.1,
      y: 0.14,
      w: 0.8,
      h: 0.03,
    });
  });

  it("keeps a shared stem with the first part", () => {
    const parts = splitIntoParts([
      line("Balanced equations:", 100),
      line("(a) first reaction", 140),
      line("(b) second reaction", 180),
    ]);

    expect(parts).toHaveLength(2);
    expect(parts[0].lines.map((l) => l.text)).toEqual([
      "Balanced equations:",
      "(a) first reaction",
    ]);
  });

  it("carries continuation lines into the part above them", () => {
    const parts = splitIntoParts([
      line("(a) first reaction", 100),
      line("giving a white precipitate", 140),
      line("(b) second reaction", 180),
    ]);

    expect(parts[0].lines).toHaveLength(2);
    expect(parts[1].lines).toHaveLength(1);
  });

  it("leaves a single-part answer whole", () => {
    // One leading marker is just how this answer starts, not a group.
    const parts = splitIntoParts([
      line("(a) only this part was attempted", 100),
      line("and it runs onto a second line", 140),
    ]);

    expect(parts).toHaveLength(1);
    expect(parts[0].marker).toBeNull();
    expect(parts[0].lines).toHaveLength(2);
  });
});
