import { describe, expect, it } from "vitest";
import type { AnswerBlock, ExtractedQuestion } from "@/lib/types";
import { parseQuestionNumber } from "./numbering";
import { matchByLabel } from "./mapping";

function question(displayNumber: string, index: number): ExtractedQuestion {
  const { parentNumber, subLabel } = parseQuestionNumber(displayNumber);
  return {
    id: `q${index}`,
    displayNumber,
    parentNumber,
    subLabel,
    text: `text for ${displayNumber}`,
    marks: 2,
    page: 1,
    orderIndex: index,
  };
}

function block(
  id: string,
  labelOnSheet: string | null,
  options: { continues?: boolean; page?: number } = {},
): AnswerBlock {
  return {
    id,
    labelOnSheet,
    transcription: `answer ${id}`,
    regions: [
      { page: options.page ?? 1, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 } },
    ],
    continuesFromPrevPage: options.continues ?? false,
  };
}

describe("matchByLabel", () => {
  it("matches by the written number regardless of the order answered", () => {
    const questions = ["1", "2", "3"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.3)"),
      block("b2", "Q.1)"),
      block("b3", "Q.2)"),
    ]);

    expect(assigned.get("q2")).toEqual(["b1"]); // printed "3"
    expect(assigned.get("q0")).toEqual(["b2"]); // printed "1"
    expect(leftovers).toEqual([]);
  });

  it("keeps an answer that runs onto the next page with its question", () => {
    const questions = ["21", "22"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.21)", { page: 1 }),
      block("b2", null, { continues: true, page: 2 }),
      block("b3", "Q.22)", { page: 2 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
    expect(assigned.get("q1")).toEqual(["b3"]);
    expect(leftovers).toEqual([]);
  });

  it("resolves a parent-only label when one sub-part is still open", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [
      block("b1", "Q.24)(a)"),
      block("b2", "Q.24)"), // student dropped the "(b)"
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(assigned.get("q1")).toEqual(["b2"]);
  });

  it("refuses to guess when a parent-only label fits several sub-parts", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.24)"),
    ]);

    expect(assigned.size).toBe(0);
    expect(leftovers.map((b) => b.id)).toEqual(["b1"]);
  });

  it("folds a bare sub-part marker into the answer above it", () => {
    const questions = ["26"].map(question); // paper prints one question 26
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.26)"),
      block("b2", "(b)"), // student marked the second half, no number
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
    expect(leftovers).toEqual([]);
  });

  it("sends a bare sub-part to its own printed sub-part when there is one", () => {
    const questions = ["23 (a)", "23 (b)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.23)(a)"),
      block("b2", "(b)"),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(assigned.get("q1")).toEqual(["b2"]);
    expect(leftovers).toEqual([]);
  });

  it("treats unlabelled text opening a page as a continuation", () => {
    const questions = ["24"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.24)", { page: 8 }),
      // The model reported continuesFromPrevPage: false for this fragment.
      block("b2", null, { page: 9 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
    expect(leftovers).toEqual([]);
  });

  it("does not swallow unlabelled text that starts mid-page", () => {
    const questions = ["1", "2"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.1)", { page: 1 }),
      block("b2", null, { page: 1 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(leftovers.map((b) => b.id)).toEqual(["b2"]);
  });

  it("leaves an answer with no matching question unassigned", () => {
    const questions = ["1", "2"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.1)"),
      block("b2", "Q.15)"), // no such question on the paper
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(leftovers.map((b) => b.id)).toEqual(["b2"]);
  });

  it("does not attach a stray continuation to an unrelated question", () => {
    const questions = ["1"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.99)"), // unmatched, so nothing to continue from
      block("b2", null, { continues: true }),
    ]);

    expect(assigned.size).toBe(0);
    expect(leftovers.map((b) => b.id)).toEqual(["b1", "b2"]);
  });
});
