import { describe, expect, it } from "vitest";
import type { AnswerBlock, ExtractedQuestion } from "@/lib/types";
import { parseQuestionNumber } from "./numbering";
import { matchByLabel, materialiseParts } from "./mapping";

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
  options: { page?: number; y?: number; h?: number } = {},
): AnswerBlock {
  return {
    id,
    labelOnSheet,
    transcription: `answer ${id}`,
    regions: [
      {
        page: options.page ?? 1,
        box: { x: 0.1, y: options.y ?? 0.1, w: 0.5, h: options.h ?? 0.1 },
      },
    ],
    continuesFromPrevPage: false,
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

  it("keeps everything written under a number with that question", () => {
    // The rule the sheet itself follows: Q.21 owns the page until Q.22.
    const questions = ["21", "22"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.21)", { page: 1, y: 0.8 }),
      block("b2", null, { page: 2, y: 0.3 }),
      block("b3", null, { page: 2, y: 0.6 }),
      block("b4", "Q.22)", { page: 3, y: 0.1 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2", "b3"]);
    expect(assigned.get("q1")).toEqual(["b4"]);
    expect(leftovers).toEqual([]);
  });

  it("does not care how far below the answer continues", () => {
    // A gap is how a student's handwriting looks, not evidence of a new answer.
    const questions = ["1", "2"].map(question);
    const { assigned } = matchByLabel(questions, [
      block("b1", "Q.1)", { y: 0.05, h: 0.05 }),
      block("b2", null, { y: 0.85, h: 0.05 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
  });

  it("resolves a parent-only label to the sub-part being answered", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.24)"),
      block("b2", "(b)"),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(assigned.get("q1")).toEqual(["b2"]);
    expect(leftovers).toEqual([]);
  });

  it("holds a sub-part open until the next marker", () => {
    const questions = ["26 (a)", "26 (b)", "27"].map(question);
    const { assigned } = matchByLabel(questions, [
      block("b1", "Q.26)"),
      block("b2", null),
      block("b3", "(b)"),
      block("b4", null),
      block("b5", "Q.27)"),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
    expect(assigned.get("q1")).toEqual(["b3", "b4"]);
    expect(assigned.get("q2")).toEqual(["b5"]);
  });

  it("matches both halves when the paper prints them separately", () => {
    const questions = ["24 (b)(i)", "24 (b)(ii)"].map(question);
    const { assigned } = matchByLabel(questions, [
      block("b1", "Q.24)(b)(i)"),
      block("b2", "(ii)"),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(assigned.get("q1")).toEqual(["b2"]);
  });

  it("still matches when the paper prints only the shallow label", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [block("b1", "Q.24)(b)(i)")]);

    expect(assigned.get("q1")).toEqual(["b1"]);
  });

  it("files a multiple-choice answer under the question, not a part of it", () => {
    // "Q.9) (c) 100% round and yellow" names the option the student chose. The
    // paper prints no 9 (c) for it to mean, so the answer belongs to 9 itself.
    const questions = ["8", "9", "10"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "9 (c)"),
      block("b2", "10 (C) (i)"),
    ]);

    expect(assigned.get("q1")).toEqual(["b1"]);
    expect(assigned.get("q2")).toEqual(["b2"]);
    expect(leftovers).toEqual([]);
  });

  it("still reads a marker as a sub-part when the paper prints one", () => {
    // Same shape of label, opposite meaning — the paper is what tells them apart.
    const questions = ["9 (a)", "9 (b)", "9 (c)"].map(question);
    const { assigned } = matchByLabel(questions, [block("b1", "9 (c)")]);

    expect(assigned.get("q2")).toEqual(["b1"]);
  });

  it("resolves a multiple-choice label even after the question is answered", () => {
    // The old fallback took the first UNASSIGNED question under the parent, so
    // a second block naming question 9 was stranded. The paper's own key is not
    // consumed by an earlier match.
    const questions = ["9", "10"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "9 (c)"),
      block("b2", "Q.9) (c)"),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
    expect(leftovers).toEqual([]);
  });

  it("takes the second reading of a number the paper does not print", () => {
    // The sheet said "Q.24) (b)"; the transcription came back "(i)", which
    // addresses a sub-part 24 has no printed form of. The paper decides.
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [
      { ...block("b1", "24 (i)"), labelReported: "Q.24) (b)" },
    ]);

    expect(assigned.get("q1")).toEqual(["b1"]);
  });

  it("keeps the first reading when it resolves", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [
      { ...block("b1", "24 (a)"), labelReported: "Q.24) (b)" },
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
  });

  it("leaves an answer numbered for a question the paper lacks", () => {
    const questions = ["1", "2"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.1)"),
      block("b2", "Q.15)"), // no such question on the paper
      block("b3", null),
    ]);

    // The stray does not take the thread with it: b3 still belongs to Q1.
    expect(assigned.get("q0")).toEqual(["b1", "b3"]);
    expect(leftovers.map((b) => b.id)).toEqual(["b2"]);
  });

  it("leaves what was written before any question number", () => {
    const questions = ["1"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", null),
      block("b2", "Q.1)"),
    ]);

    expect(assigned.get("q0")).toEqual(["b2"]);
    expect(leftovers.map((b) => b.id)).toEqual(["b1"]);
  });
});

/** One line of a written answer the student split into "(a)" and "(b)". */
function part(
  id: string,
  groupId: string,
  marker: string,
  labelOnSheet: string | null,
  y = 0.1,
): AnswerBlock {
  return {
    id,
    labelOnSheet,
    transcription: `answer part ${marker}`,
    regions: [{ page: 1, box: { x: 0.1, y, w: 0.5, h: 0.05 } }],
    continuesFromPrevPage: false,
    groupId,
    partMarker: marker,
  };
}

describe("matchByLabel with grouped parts", () => {
  it("hands each part of one answer to its own sub-question", () => {
    const questions = ["26 (a)", "26 (b)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      part("g1_1", "g1", "a", "Q.26)"),
      part("g1_2", "g1", "b", "(b)", 0.2),
    ]);

    expect(assigned.get("q0")).toEqual(["g1_1"]);
    expect(assigned.get("q1")).toEqual(["g1_2"]);
    expect(leftovers).toEqual([]);
  });

  it("files an unnumbered group under the question already open", () => {
    const questions = ["25", "26 (a)", "26 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [
      block("b1", "Q.25)"),
      part("g1_1", "g1", "a", "(a)", 0.4),
      part("g1_2", "g1", "b", "(b)", 0.5),
    ]);

    // Nothing said question 26 had begun, so it is all still 25's.
    expect(assigned.get("q0")).toEqual(["b1", "g1_1", "g1_2"]);
  });
});

function withParts(
  id: string,
  labelOnSheet: string | null,
  markers: string[],
): AnswerBlock {
  return {
    id,
    labelOnSheet,
    transcription: markers.map((m) => `(${m}) something`).join(" "),
    regions: [{ page: 1, box: { x: 0.1, y: 0.1, w: 0.7, h: 0.3 } }],
    continuesFromPrevPage: false,
    parts: markers.map((marker, i) => ({
      marker,
      transcription: `(${marker}) something`,
      regions: [
        { page: 1, box: { x: 0.1, y: 0.1 + i * 0.05, w: 0.7, h: 0.04 } },
      ],
    })),
  };
}

describe("materialiseParts", () => {
  it("splits an answer whose markers all have a printed sub-question", () => {
    const questions = ["26 (a)", "26 (b)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p10b3", "Q.26)", ["a", "b"]),
    ]);

    expect(out.map((b) => b.id)).toEqual(["p10b3_1", "p10b3_2"]);
    expect(out.map((b) => b.partMarker)).toEqual(["a", "b"]);
    expect(out.every((b) => b.groupId === "p10b3")).toBe(true);
    expect(out[0].regions[0].box.y).toBeCloseTo(0.1, 6);
    expect(out[1].regions[0].box.y).toBeCloseTo(0.15, 6);
  });

  it("leaves a list of observations as one answer", () => {
    // The paper prints no 25 (i), so splitting would shatter one answer into
    // four highlights of the same question.
    const questions = ["25", "26 (a)", "26 (b)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p9b1", "Q.25)", ["i", "ii", "iii", "iv"]),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].parts).toBeUndefined();
  });

  it("leaves an answer whole when only some markers have a sub-question", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p8b2", "Q.24)(b)", ["b", "ii"]),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].regions[0].box.h).toBeCloseTo(0.3, 6);
  });

  it("does not split an answer whose own question has no sub-parts", () => {
    const questions = ["22 (a)", "22 (b)", "28"].map(question);
    const out = materialiseParts(questions, [
      withParts("p9b1", "Q.28)", ["a", "b"]),
    ]);

    expect(out).toHaveLength(1);
  });

  it("needs an exact set of sub-parts when the student named nothing", () => {
    const questions = ["30 (a)", "30 (b)", "30 (c)"].map(question);
    expect(
      materialiseParts(questions, [withParts("p1b1", null, ["a", "b"])]),
    ).toHaveLength(1);
    expect(
      materialiseParts(questions, [withParts("p1b1", null, ["a", "b", "c"])]),
    ).toHaveLength(3);
  });

  it("splits an answer marked (i) and (ii) against a nested paper", () => {
    const questions = ["24 (b)(i)", "24 (b)(ii)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p8b1", "Q.24)(b)", ["i", "ii"]),
    ]);

    expect(out.map((b) => b.partMarker)).toEqual(["i", "ii"]);
  });

  it("passes a block with no marked sections straight through", () => {
    const questions = ["1"].map(question);
    const plain = block("b1", "Q.1)");
    expect(materialiseParts(questions, [plain])).toEqual([
      { ...plain, parts: undefined },
    ]);
  });
});
