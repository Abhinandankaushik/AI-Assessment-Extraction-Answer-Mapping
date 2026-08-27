import { describe, expect, it } from "vitest";
import { bareSubPart, numberKey, parseQuestionNumber } from "./numbering";

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
    ["Q 24 (b)(i)", "24b"],
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
