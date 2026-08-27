import type { AnswerBlock, ExtractedQuestion, MatchBasis } from "@/lib/types";
import {
  bareSubPart,
  lastSubPart,
  numberKey,
  parentNumberOf,
  shallowKey,
} from "./numbering";

export interface QuestionMatch {
  questionId: string;
  blockIds: string[];
  basis: MatchBasis;
  confidence: number;
}

export interface MappingOutcome {
  matches: QuestionMatch[];
  unansweredQuestionIds: string[];
  orphanBlockIds: string[];
}

/**
 * Turns the sections a student marked inside one answer into separate blocks —
 * but only when the paper prints a sub-question for EVERY one of them.
 *
 * That condition is the whole point. A student answering 26 (a) and 26 (b)
 * writes "(a)" and "(b)", and the paper has a row waiting for each, so the two
 * halves should be highlighted and marked apart. A student listing four
 * observations under one question writes "(i) (ii) (iii) (iv)" against a paper
 * that prints no such parts — splitting that shatters one answer into four
 * highlights of the same question, which is noise, not precision.
 */
export function materialiseParts(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
): AnswerBlock[] {
  const subLabelsOf = (parent: string) =>
    new Set(
      questions
        .filter((q) => q.parentNumber === parent)
        .map((q) => lastSubPart(q.displayNumber))
        .filter((label): label is string => Boolean(label)),
    );

  const parents = [
    ...new Set(
      questions
        .map((q) => (lastSubPart(q.displayNumber) ? q.parentNumber : null))
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  return blocks.flatMap<AnswerBlock>((block) => {
    const parts = block.parts ?? [];
    const plain = { ...block, parts: undefined };
    if (parts.length < 2) return [plain];

    const markers = parts.map((part) => part.marker);
    // The question the student named, when they named one. Splitting against
    // that parent is exact; splitting against "some question, somewhere on the
    // paper, that happens to have these letters" is how an answer to a question
    // with no sub-parts gets torn in half.
    const named = block.labelOnSheet ? parentNumberOf(block.labelOnSheet) : null;

    const candidates = named ? [named] : parents;
    const covered = candidates.some((parent) => {
      const subLabels = subLabelsOf(parent);
      // Without a name to go on, the paper's sub-parts must match the student's
      // markers exactly - a superset would fit far too many answers.
      return named
        ? markers.every((m) => subLabels.has(m))
        : subLabels.size === markers.length &&
            markers.every((m) => subLabels.has(m));
    });
    if (!covered) return [plain];

    return parts.map((part, index) => ({
      id: `${block.id}_${index + 1}`,
      // Only the first part inherits the number the student wrote; the rest
      // carry the marker they were written with.
      labelOnSheet: index === 0 ? block.labelOnSheet : `(${part.marker})`,
      transcription: part.transcription,
      regions: part.regions,
      continuesFromPrevPage: index === 0 && block.continuesFromPrevPage,
      groupId: block.id,
      partMarker: part.marker,
    }));
  });
}

/** Consecutive parts of one written answer, kept together for matching. */
function groupUnits(blocks: AnswerBlock[]): AnswerBlock[][] {
  const units: AnswerBlock[][] = [];
  for (const block of blocks) {
    const last = units[units.length - 1];
    if (block.groupId && last?.[0]?.groupId === block.groupId) last.push(block);
    else units.push([block]);
  }
  return units;
}

/**
 * Reads the sheet the way it was written.
 *
 * A student writes a question number and then answers under it, so a number
 * opens a question and everything below belongs to that question until the next
 * number appears — however far down the page, across however many page breaks.
 * Within that run "(a)" opens a sub-part and holds until "(b)" or the next
 * question number.
 *
 * Earlier versions tried to be cleverer. Geometry decided whether a fragment
 * continued the answer above it, and whatever fell through was handed to the
 * model to match on subject matter instead. Both went wrong in ways a teacher
 * sees at a glance: half an answer highlighted because the gap above the rest
 * was a millimetre too wide, and answers filed under questions they were plainly
 * not written for. The student already wrote down which question they were
 * answering; nothing here is better evidence than that.
 */
export function matchByLabel(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
): {
  assigned: Map<string, string[]>;
  leftovers: AnswerBlock[];
} {
  // Both keys are registered per question so a sheet and a paper that disagree
  // about depth still meet: a paper printing "24 (b)(i)" and "24 (b)(ii)" keeps
  // them apart, while a sheet writing "Q.24)(b)(i)" against a paper that prints
  // only "24 (b)" still lands.
  const byKey = new Map<string, string>();
  for (const q of questions) {
    for (const key of [numberKey(q.displayNumber), shallowKey(q.displayNumber)]) {
      if (!byKey.has(key)) byKey.set(key, q.id);
    }
  }
  const lookup = (label: string) =>
    byKey.get(numberKey(label)) ?? byKey.get(shallowKey(label));

  const assigned = new Map<string, string[]>();
  const leftovers: AnswerBlock[] = [];
  /** The question everything written from here on belongs to. */
  let openQuestionId: string | null = null;
  /** The number that opened it, so a bare "(b)" knows whose sibling it wants. */
  let openParent: string | null = null;

  const push = (questionId: string, blockId: string) => {
    const list = assigned.get(questionId) ?? [];
    list.push(blockId);
    assigned.set(questionId, list);
  };

  const openUnder = (parent: string) =>
    questions.filter((q) => q.parentNumber === parent && !assigned.has(q.id));

  const siblingFor = (parent: string, marker: string) =>
    questions.find(
      (q) =>
        q.parentNumber === parent &&
        lastSubPart(q.displayNumber) === marker &&
        !assigned.has(q.id),
    );

  /** Files a unit under whatever is open, following each part's own marker. */
  const file = (unit: AnswerBlock[]) => {
    for (const part of unit) {
      const marker = part.partMarker ?? null;
      const sibling =
        marker && openParent ? siblingFor(openParent, marker) : undefined;
      if (sibling) openQuestionId = sibling.id;
      if (openQuestionId) push(openQuestionId, part.id);
      else leftovers.push(part);
    }
  };

  for (const unit of groupUnits(blocks)) {
    const label = unit[0].labelOnSheet;
    const parent = label ? parentNumberOf(label) : null;

    if (label && parent) {
      // A written question number opens a new question. When the paper prints
      // only sub-parts under it, the first one still open is the one being
      // answered — students work through parts in order.
      const named = lookup(label) ?? openUnder(parent)[0]?.id ?? null;
      if (named) {
        openQuestionId = named;
        openParent = parent;
        file(unit);
      } else {
        // A number the paper does not print, so this answer is a stray. The
        // question already open stays open: losing the thread here would strand
        // everything written after it as well.
        leftovers.push(...unit);
      }
      continue;
    }

    // A bare "(b)" names a sub-part of the question already open.
    const marker = label ? bareSubPart(label) : null;
    if (marker && openParent) {
      const sibling = siblingFor(openParent, marker);
      if (sibling) openQuestionId = sibling.id;
    }
    file(unit);
  }

  return { assigned, leftovers };
}

export function mapAnswersToQuestions(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
): MappingOutcome {
  const { assigned, leftovers } = matchByLabel(questions, blocks);

  const matches: QuestionMatch[] = [...assigned.entries()].map(
    ([questionId, blockIds]) => ({
      questionId,
      blockIds,
      basis: "label" as MatchBasis,
      confidence: 1,
    }),
  );

  const answered = new Set(matches.map((m) => m.questionId));
  return {
    matches,
    unansweredQuestionIds: questions
      .filter((q) => !answered.has(q.id))
      .map((q) => q.id),
    // Only what was written before the student's first question number, which
    // on a sheet that carries any numbering at all is nothing.
    orphanBlockIds: leftovers.map((b) => b.id),
  };
}
