import { describe, expect, it } from "vitest";
import type { AnswerBlock, ExtractedQuestion } from "@/lib/types";
import { parseQuestionNumber } from "./numbering";
import {
  matchByLabel,
  materialiseParts,
  snapGroups,
  type QuestionMatch,
} from "./mapping";

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

  it("distributes a group even when the student wrote the exact sub-part", () => {
    const questions = ["26 (a)", "26 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [
      part("g1_1", "g1", "a", "Q.26)(a)"),
      part("g1_2", "g1", "b", "(b)", 0.2),
    ]);

    expect(assigned.get("q0")).toEqual(["g1_1"]);
    expect(assigned.get("q1")).toEqual(["g1_2"]);
  });

  it("does not bury an unnumbered group under the answer above it", () => {
    // The head's "(a)" names a part, not a question: reading it as a
    // continuation would file this whole answer under 25.
    const questions = ["25", "26 (a)", "26 (b)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.25)"),
      part("g1_1", "g1", "a", "(a)", 0.4),
      part("g1_2", "g1", "b", "(b)", 0.5),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(leftovers.map((b) => b.id)).toEqual(["g1_1", "g1_2"]);
  });
});

describe("snapGroups", () => {
  it("pulls the rest of a group in once one part has found its question", () => {
    const questions = ["26 (a)", "26 (b)"].map(question);
    const blocks = [
      part("g1_1", "g1", "a", "(a)"),
      part("g1_2", "g1", "b", "(b)", 0.2),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q0", blockIds: ["g1_1"], basis: "semantic", confidence: 0.8 },
    ];

    const orphans = snapGroups(questions, blocks, matches, ["g1_2"]);

    expect(orphans).toEqual([]);
    expect(matches.map((m) => [m.questionId, m.blockIds])).toEqual([
      ["q0", ["g1_1"]],
      ["q1", ["g1_2"]],
    ]);
  });

  it("leaves an orphan alone when its sub-question is already answered", () => {
    const questions = ["26 (a)", "26 (b)"].map(question);
    const blocks = [
      part("g1_1", "g1", "a", "(a)"),
      part("g1_2", "g1", "b", "(b)", 0.2),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q0", blockIds: ["g1_1"], basis: "semantic", confidence: 0.8 },
      { questionId: "q1", blockIds: ["other"], basis: "label", confidence: 1 },
    ];

    expect(snapGroups(questions, blocks, matches, ["g1_2"])).toEqual(["g1_2"]);
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
      regions: [{ page: 1, box: { x: 0.1, y: 0.1 + i * 0.05, w: 0.7, h: 0.04 } }],
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
    // Each part keeps its own region, which is the point of splitting at all.
    expect(out[0].regions[0].box.y).toBeCloseTo(0.1, 6);
    expect(out[1].regions[0].box.y).toBeCloseTo(0.15, 6);
  });

  it("leaves a list of observations as one answer", () => {
    // The student numbered four observations under Q25. The paper prints no
    // 25 (i) or 25 (ii), so splitting would shatter one answer into four
    // highlights of the same question.
    const questions = ["25", "26 (a)", "26 (b)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p9b1", "Q.25)", ["i", "ii", "iii", "iv"]),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("p9b1");
    expect(out[0].parts).toBeUndefined();
  });

  it("leaves an answer whole when only some markers have a sub-question", () => {
    // "24 (b)" is one printed question containing (i) and (ii): both halves
    // belong to the same row, so they must highlight together.
    const questions = ["24 (a)", "24 (b)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p8b2", "Q.24)(b)", ["b", "ii"]),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].regions[0].box.h).toBeCloseTo(0.3, 6);
  });

  it("passes a block with no marked sections straight through", () => {
    const questions = ["1"].map(question);
    const plain = block("b1", "Q.1)");
    expect(materialiseParts(questions, [plain])).toEqual([
      { ...plain, parts: undefined },
    ]);
  });
});
