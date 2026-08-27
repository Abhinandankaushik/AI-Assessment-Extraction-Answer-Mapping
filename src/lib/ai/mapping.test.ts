import { describe, expect, it } from "vitest";
import type { AnswerBlock, ExtractedQuestion } from "@/lib/types";
import { parseQuestionNumber } from "./numbering";
import {
  absorbTrailingFragments,
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
  options: { continues?: boolean; page?: number; y?: number; h?: number } = {},
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

  it("gives a parent-only label the first sub-part still open", () => {
    // Students answer parts in order. Refusing to choose sent the whole run to
    // the semantic pass, which had only subject matter to go on and filed the
    // answers under other questions entirely.
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.24)", { y: 0.1, h: 0.1 }),
      block("b2", "(b)", { y: 0.3, h: 0.1 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(assigned.get("q1")).toEqual(["b2"]);
    expect(leftovers).toEqual([]);
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

  it("keeps the rest of a long answer that runs on below it", () => {
    // The tail of Q25 came back as its own unlabelled block, directly under
    // the part that carried the number.
    const questions = ["25", "26"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.25)", { y: 0.1, h: 0.2 }),
      block("b2", null, { y: 0.31, h: 0.06 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1", "b2"]);
    expect(leftovers).toEqual([]);
  });

  it("does not swallow unlabelled text that starts after a gap", () => {
    // Space above it is what an unnumbered answer of its own looks like, so
    // this goes to the semantic pass rather than onto the answer above.
    const questions = ["1", "2"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.1)", { y: 0.1, h: 0.1 }),
      block("b2", null, { y: 0.55 }),
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
      block("b1", "Q.99)", { y: 0.1, h: 0.1 }), // unmatched: nothing to continue
      block("b2", null, { continues: true, y: 0.21 }),
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

describe("absorbTrailingFragments", () => {
  it("gives a trailing fragment back to the answer it runs on from", () => {
    // Q24 (b) was matched by content, so matchByLabel never held it open and
    // the "(ii)" half below it had nothing to attach to.
    const blocks = [
      block("b1", null, { y: 0.1, h: 0.25 }),
      block("b2", "(ii)", { y: 0.36, h: 0.2 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "semantic", confidence: 0.8 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual([]);
    expect(matches[0].blockIds).toEqual(["b1", "b2"]);
  });

  it("chains a run of fragments onto the same answer", () => {
    const blocks = [
      block("b1", "Q.9)", { y: 0.1, h: 0.1 }),
      block("b2", null, { y: 0.21, h: 0.1 }),
      block("b3", null, { y: 0.32, h: 0.1 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "label", confidence: 1 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2", "b3"])).toEqual([]);
    expect(matches[0].blockIds).toEqual(["b1", "b2", "b3"]);
  });

  it("leaves a fragment carrying a question number of its own", () => {
    const blocks = [
      block("b1", "Q.9)", { y: 0.1, h: 0.1 }),
      block("b2", "Q.40)", { y: 0.21, h: 0.1 }), // no such question on the paper
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "label", confidence: 1 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual(["b2"]);
    expect(matches[0].blockIds).toEqual(["b1"]);
  });

  it("leaves a fragment that starts after a gap", () => {
    const blocks = [
      block("b1", "Q.9)", { y: 0.1, h: 0.1 }),
      block("b2", null, { y: 0.6, h: 0.1 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "label", confidence: 1 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual(["b2"]);
  });
});

describe("absorbTrailingFragments across a page break", () => {
  it("gives the top of the next page back to the answer it continues", () => {
    // "and roots is transported to buds." opened page 8, carrying on from an
    // answer matched by content at the foot of page 7.
    const blocks = [
      block("b1", null, { page: 7, y: 0.7, h: 0.25 }),
      block("b2", null, { page: 8, y: 0.06, h: 0.04 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "semantic", confidence: 0.8 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual([]);
    expect(matches[0].blockIds).toEqual(["b1", "b2"]);
  });

  it("clears the printed header a page carries above the handwriting", () => {
    // An answer booklet prints a header and QR band across the top of every
    // page, so a continuation starts a quarter of the way down, not at the edge.
    const blocks = [
      block("b1", null, { page: 7, y: 0.7, h: 0.25 }),
      block("b2", null, { page: 8, y: 0.28, h: 0.1 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "semantic", confidence: 0.8 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual([]);
    expect(matches[0].blockIds).toEqual(["b1", "b2"]);
  });

  it("leaves text that starts well down a fresh page", () => {
    // Half a blank page above it means the student began something new here.
    const blocks = [
      block("b1", null, { page: 7, y: 0.7, h: 0.25 }),
      block("b2", null, { page: 8, y: 0.62, h: 0.1 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "semantic", confidence: 0.8 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual(["b2"]);
  });

  it("does not reach across a skipped page", () => {
    const blocks = [
      block("b1", null, { page: 7, y: 0.7, h: 0.25 }),
      block("b2", null, { page: 9, y: 0.06, h: 0.04 }),
    ];
    const matches: QuestionMatch[] = [
      { questionId: "q1", blockIds: ["b1"], basis: "semantic", confidence: 0.8 },
    ];

    expect(absorbTrailingFragments(blocks, matches, ["b2"])).toEqual(["b2"]);
  });
});

describe("matchByLabel with nested sub-parts", () => {
  it("matches both halves when the paper prints them separately", () => {
    // Collapsing "24 (b)(i)" and "24 (b)(ii)" to one key left the second
    // permanently unmatchable, showing as "Not attempted" beside its answer.
    const questions = ["24 (b)(i)", "24 (b)(ii)"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.24)(b)(i)", { y: 0.1, h: 0.2 }),
      block("b2", "(ii)", { y: 0.5, h: 0.2 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(assigned.get("q1")).toEqual(["b2"]);
    expect(leftovers).toEqual([]);
  });

  it("still matches when the paper prints only the shallow label", () => {
    const questions = ["24 (a)", "24 (b)"].map(question);
    const { assigned } = matchByLabel(questions, [
      block("b1", "Q.24)(b)(i)"),
    ]);

    expect(assigned.get("q1")).toEqual(["b1"]);
  });
});

describe("materialiseParts against the right question", () => {
  it("splits against the parent the student named", () => {
    const questions = ["22 (a)", "22 (b)", "26 (a)", "26 (b)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p10b3", "Q.26)", ["a", "b"]),
    ]);

    expect(out.map((b) => b.partMarker)).toEqual(["a", "b"]);
  });

  it("does not split an answer whose own question has no sub-parts", () => {
    // Q28 has no parts; without naming the question, "some question somewhere
    // has an (a) and a (b)" was enough to tear this answer in half.
    const questions = ["22 (a)", "22 (b)", "28"].map(question);
    const out = materialiseParts(questions, [
      withParts("p9b1", "Q.28)", ["a", "b"]),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].parts).toBeUndefined();
  });

  it("needs an exact set of sub-parts when the student named nothing", () => {
    const questions = ["30 (a)", "30 (b)", "30 (c)"].map(question);
    // Markers (a) and (b) against a parent printing (a), (b) and (c) is a
    // guess, not a match.
    expect(materialiseParts(questions, [withParts("p1b1", null, ["a", "b"])])).toHaveLength(1);
    expect(
      materialiseParts(questions, [withParts("p1b1", null, ["a", "b", "c"])]),
    ).toHaveLength(3);
  });
});

describe("matchByLabel keeps its bearings", () => {
  it("stops following an answer once something else is written between", () => {
    // b2 belongs to nothing, so b3 below it is not a continuation of q0.
    const questions = ["1", "2"].map(question);
    const { assigned, leftovers } = matchByLabel(questions, [
      block("b1", "Q.1)", { y: 0.1, h: 0.1 }),
      block("b2", null, { y: 0.6, h: 0.1 }),
      block("b3", null, { y: 0.71, h: 0.1 }),
    ]);

    expect(assigned.get("q0")).toEqual(["b1"]);
    expect(leftovers.map((b) => b.id)).toEqual(["b2", "b3"]);
  });

  it("splits an answer marked (i) and (ii) against a nested paper", () => {
    const questions = ["24 (b)(i)", "24 (b)(ii)"].map(question);
    const out = materialiseParts(questions, [
      withParts("p8b1", "Q.24)(b)", ["i", "ii"]),
    ]);

    expect(out.map((b) => b.partMarker)).toEqual(["i", "ii"]);
  });
});
