import { describe, expect, it } from "vitest";
import { splitInlineSubParts } from "./questions";

const q = (
  displayNumber: string,
  text: string,
  marks: number | null = 2,
  page = 1,
) => ({ displayNumber, text, marks, page });

describe("splitInlineSubParts", () => {
  it("splits sub-parts printed inline with their stem", () => {
    const parts = splitInlineSubParts(
      q(
        "26",
        "Write balanced chemical equations for the following reactions: (a) Nitric acid reacts with calcium hydroxide. (b) Sodium chloride solution reacts with silver nitrate solution.",
      ),
    );

    expect(parts.map((p) => p.displayNumber)).toEqual(["26 (a)", "26 (b)"]);
    // The stem is repeated so each part reads on its own when marked.
    expect(parts[0].text).toBe(
      "Write balanced chemical equations for the following reactions: Nitric acid reacts with calcium hydroxide.",
    );
    expect(parts.map((p) => p.marks)).toEqual([1, 1]);
  });

  it("splits the printed marks across the parts", () => {
    const parts = splitInlineSubParts(
      q(
        "12",
        "Answer the following about the human eye: (a) Explain why the pupil changes size in bright light. (b) Explain how the ciliary muscles help in focusing.",
        3,
      ),
    );

    expect(parts).toHaveLength(2);
    expect(parts.map((p) => p.marks)).toEqual([1.5, 1.5]);
  });

  it("never splits a multiple-choice option list", () => {
    // The single mark is what separates an objective question from sub-parts.
    const mcq = q(
      "1",
      "Hard water contains dissolved salts of which pair of metals? (a) sodium and potassium (b) calcium and magnesium (c) iron and copper (d) zinc and lead",
      1,
    );
    expect(splitInlineSubParts(mcq)).toEqual([mcq]);
  });

  it("never splits four lettered items even when the marks are high", () => {
    const four = q(
      "5",
      "Choose the correct option for the reaction shown above: (a) displacement (b) combination (c) decomposition (d) double displacement",
      4,
    );
    expect(splitInlineSubParts(four)).toEqual([four]);
  });

  it("leaves a question that is already a sub-part alone", () => {
    const sub = q("24 (b)", "State two differences (a) in structure and (b) in function of arteries.");
    expect(splitInlineSubParts(sub)).toEqual([sub]);
  });

  it("leaves markers that do not run from (a) alone", () => {
    const odd = q("9", "Explain the process shown in (b) and then in (c) of the diagram above.");
    expect(splitInlineSubParts(odd)).toEqual([odd]);
  });

  it("leaves a question with no stem alone", () => {
    const noStem = q("9", "(a) Define resistance clearly. (b) State its SI unit precisely.");
    expect(splitInlineSubParts(noStem)).toEqual([noStem]);
  });

  it("leaves a question whose parts are too thin to stand alone", () => {
    const thin = q("9", "Give the formula of the following salts: (a) NaCl (b) KNO3");
    expect(splitInlineSubParts(thin)).toEqual([thin]);
  });
});
