import { describe, expect, it } from "vitest";
import {
  bareSubPart,
  compactLabel,
  leadingLabel,
  numberKey,
  parseQuestionNumber,
  shallowKey,
} from "./numbering";

describe("parseQuestionNumber", () => {
  it("splits a printed sub-part into parent and label", () => {
    expect(parseQuestionNumber("11 (a)")).toEqual({
      parentNumber: "11",
      subLabel: "a",
    });
  });

  it("leaves subLabel null for a plain question", () => {
    expect(parseQuestionNumber("7.")).toEqual({
      parentNumber: "7",
      subLabel: null,
    });
  });

  it("reads roman sub-parts", () => {
    expect(parseQuestionNumber("12 (iii)").subLabel).toBe("iii");
  });
});

describe("numberKey", () => {
  // The whole point of the key is that what a student scrawls and what the
  // paper prints collapse to the same string.
  it.each([
    ["Q.1)", "1"],
    ["1.", "1"],
    ["Question 5:", "5"],
    ["Ans 7.", "7"],
    ["Q.22)(a)", "22a"],
    ["22 (a)", "22a"],
    ["Q 24 (b)(i)", "24bi"],
    ["11(B)", "11b"],
  ])("maps %s to %s", (input, expected) => {
    expect(numberKey(input)).toBe(expected);
  });

  it("matches a sheet label against the printed question", () => {
    expect(numberKey("Q.22)(a)")).toBe(numberKey("22 (a)"));
    expect(numberKey("Q.1)")).toBe(numberKey("1"));
  });

  it("keeps a parent-only label distinct from its sub-parts", () => {
    // A student who writes just "Q.24" cannot be matched by key alone; the
    // mapper resolves that case separately rather than guessing here.
    expect(numberKey("Q.24)")).toBe("24");
    expect(numberKey("24 (b)")).toBe("24b");
  });
});

describe("bareSubPart", () => {
  it.each(["(b)", "b)", "b.", " (B) ", "(ii)", "iii)"])(
    "reads %s as a sub-part marker",
    (input) => {
      expect(bareSubPart(input)).toBe(input.trim().replace(/[().\s]/g, "").toLowerCase());
    },
  );

  it.each(["Q.26)", "26 (b)", "the", "and", ""])(
    "does not read %s as a sub-part marker",
    (input) => {
      expect(bareSubPart(input)).toBeNull();
    },
  );
});

describe("compactLabel", () => {
  it("collapses the same label written with different spacing", () => {
    const keys = ["26 (b)", "26(b)", "26 b", "26. (B)"].map(compactLabel);
    expect(new Set(keys).size).toBe(1);
  });

  it("keeps labels that are genuinely different apart", () => {
    // Two passes both reporting "24 (b)(i)" must dedupe; "(ii)" must not.
    expect(compactLabel("24 (b)(i)")).not.toBe(compactLabel("24 (b)(ii)"));
    expect(compactLabel("26 (a)")).not.toBe(compactLabel("26 (b)"));
  });
});

describe("nested sub-parts", () => {
  it("keeps two-level labels apart", () => {
    // A paper printing both needs two keys, or the second can never be matched.
    expect(numberKey("24 (b)(i)")).toBe("24bi");
    expect(numberKey("24 (b)(ii)")).toBe("24bii");
    expect(numberKey("24 (b)(i)")).not.toBe(numberKey("24 (b)(ii)"));
  });

  it("matches a sheet label against however deep the paper prints it", () => {
    // The paper prints "24 (b)" only; the student wrote the roman numeral too.
    expect(shallowKey("Q.24)(b)(i)")).toBe(numberKey("24 (b)"));
    // The paper prints both levels; the full key still lands on the right one.
    expect(numberKey("Q.24)(b)(ii)")).toBe(numberKey("24 (b)(ii)"));
  });

  it("leaves a one-level label alone", () => {
    expect(numberKey("22 (a)")).toBe("22a");
    expect(shallowKey("22 (a)")).toBe("22a");
    expect(numberKey("7")).toBe("7");
  });
});

describe("labels the way papers and students actually write them", () => {
  it("reads a paper that heads its rows with Q.", () => {
    // Left unstripped, every question on such a paper had a null parentNumber,
    // which took the whole paper out of the sub-part logic.
    expect(parseQuestionNumber("Q.26 (a)")).toEqual({
      parentNumber: "26",
      subLabel: "a",
    });
    expect(numberKey("Q.26 (a)")).toBe("26a");
  });

  it("reads a number the student wrapped in brackets", () => {
    expect(parseQuestionNumber("(22) (a)")).toEqual({
      parentNumber: "22",
      subLabel: "a",
    });
    expect(numberKey("(22) (a)")).toBe(numberKey("22 (a)"));
  });

  it("still refuses a label with no number in it", () => {
    expect(parseQuestionNumber("(b)")).toEqual({
      parentNumber: null,
      subLabel: null,
    });
  });
});

describe("leadingLabel", () => {
  it.each([
    ["Q.9) (C) 100% round and yellow", "9"],
    ["Q.24) (b) (i) The transport system in plants", "24 (b) (i)"],
    ["(22) (a) Lamp A -> Power = 50 W", "22 (a)"],
    ["25. For a chemical change to occur", "25"],
  ])("reads the number %s opens with", (text, expected) => {
    expect(leadingLabel(text)).toBe(expected);
  });

  it.each([
    "When 1 Joule of work is done to move",
    "1 Joule of work per coulomb of charge",
    "and roots is transported to buds.",
    "(C) Starch into simple sugars",
  ])("does not mistake %s for a question number", (text) => {
    // A number needs the punctuation a question number is written with, or an
    // answer that happens to open with a digit would claim that question.
    expect(leadingLabel(text)).toBeNull();
  });
});
