import { Type } from "@google/genai";
import type {
  AnswerBlock,
  ExtractedQuestion,
  MatchBasis,
} from "@/lib/types";
import { ThinkingLevel, generateJson } from "./client";
import { bareSubPart, numberKey } from "./numbering";

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

const SYSTEM =
  "You match a student's answers to the questions they were answering. " +
  "You are conservative: an answer with no convincing question is left unmatched.";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockId: { type: Type.STRING },
          questionId: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER },
        },
        required: ["blockId", "questionId", "confidence"],
      },
    },
  },
  required: ["matches"],
} as const;

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
 * Answers that carry a written question number are matched in plain code —
 * that is both exact and free. Only the leftovers reach the model, which keeps
 * the request count (and therefore the free-tier quota) down and stops the
 * model from second-guessing a label the student wrote themselves.
 */
export function matchByLabel(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
): {
  assigned: Map<string, string[]>;
  leftovers: AnswerBlock[];
} {
  const byKey = new Map<string, string>();
  for (const q of questions) {
    const key = numberKey(q.displayNumber);
    if (!byKey.has(key)) byKey.set(key, q.id);
  }

  const assigned = new Map<string, string[]>();
  const leftovers: AnswerBlock[] = [];
  let currentQuestionId: string | null = null;

  const push = (questionId: string, blockId: string) => {
    const list = assigned.get(questionId) ?? [];
    list.push(blockId);
    assigned.set(questionId, list);
  };

  const openSibling = (parentNumber: string | null, marker: string | null) =>
    parentNumber && marker
      ? questions.find(
          (q) =>
            q.parentNumber === parentNumber &&
            q.subLabel === marker &&
            !assigned.has(q.id),
        )
      : undefined;

  /** Hands each part of one written answer to its own sub-question, falling
   *  back to the question the group as a whole matched. */
  const distribute = (
    unit: AnswerBlock[],
    parentNumber: string | null,
    fallbackId: string,
  ) => {
    for (const part of unit) {
      const sibling = openSibling(parentNumber, part.partMarker ?? null);
      const target = sibling?.id ?? fallbackId;
      push(target, part.id);
      currentQuestionId = target;
    }
  };

  // Blocks arrive in reading order, so "first on its page" identifies text that
  // carried over from the page before.
  const firstOnPage = new Set<string>();
  const seenPages = new Set<number>();
  for (const block of blocks) {
    const page = block.regions[0]?.page;
    if (page === undefined || seenPages.has(page)) continue;
    seenPages.add(page);
    firstOnPage.add(block.id);
  }

  for (const unit of groupUnits(blocks)) {
    // A group is one answer the student split at "(a)"/"(b)". It is matched as
    // a whole, because a bare marker at its head names a part, not a question -
    // reading it as a continuation would bury the answer under the one above.
    if (unit.length > 1) {
      const head = unit[0];
      const key = head.labelOnSheet ? numberKey(head.labelOnSheet) : null;
      const exact = key ? byKey.get(key) : undefined;

      if (exact) {
        const parentNumber =
          questions.find((q) => q.id === exact)?.parentNumber ?? null;
        distribute(unit, parentNumber, exact);
        continue;
      }

      const openSubParts = key
        ? questions.filter(
            (q) => q.parentNumber === key && q.subLabel && !assigned.has(q.id),
          )
        : [];
      if (openSubParts.length > 0) {
        distribute(unit, key, openSubParts[0].id);
        continue;
      }

      currentQuestionId = null;
      leftovers.push(...unit);
      continue;
    }

    const block = unit[0];
    if (block.labelOnSheet) {
      const key = numberKey(block.labelOnSheet);
      const questionId = byKey.get(key);
      if (questionId) {
        push(questionId, block.id);
        currentQuestionId = questionId;
        continue;
      }

      // A bare sub-part marker — the student wrote "Q.26)" once and then just
      // "(b)" on the next line. It belongs to the numbered answer above it,
      // either as its own printed sub-part or folded into the parent.
      const bareSub = bareSubPart(block.labelOnSheet);
      if (bareSub && currentQuestionId) {
        const openId: string = currentQuestionId;
        const parent = questions.find((q) => q.id === openId);
        const sibling = questions.find(
          (q) =>
            q.parentNumber === parent?.parentNumber &&
            q.subLabel === bareSub &&
            !assigned.has(q.id),
        );
        const target = sibling?.id ?? openId;
        push(target, block.id);
        currentQuestionId = target;
        continue;
      }

      // Students often write the parent number only ("Q.24") on a paper that
      // prints just sub-parts. When exactly one sub-part is still open that is
      // unambiguous; when several are, leave it for the semantic pass rather
      // than guessing which one they meant.
      const openSubParts = questions.filter(
        (q) => q.parentNumber === key && q.subLabel && !assigned.has(q.id),
      );
      if (openSubParts.length === 1) {
        push(openSubParts[0].id, block.id);
        currentQuestionId = openSubParts[0].id;
        continue;
      }
      // A label that matches nothing: could be a misread digit or a genuine
      // stray answer, so let the semantic pass decide.
      currentQuestionId = null;
      leftovers.push(block);
      continue;
    }

    // Unlabelled text belongs to the answer above it. The model's
    // `continuesFromPrevPage` flag is the clear signal, but it misses short
    // fragments, so text opening a fresh page under a matched answer counts
    // too — that is exactly what a page-break continuation looks like.
    const continues =
      block.continuesFromPrevPage || firstOnPage.has(block.id);
    if (continues && currentQuestionId) {
      push(currentQuestionId, block.id);
      continue;
    }

    leftovers.push(block);
  }

  return { assigned, leftovers };
}

function snippet(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export async function mapAnswersToQuestions(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
): Promise<MappingOutcome> {
  const { assigned, leftovers } = matchByLabel(questions, blocks);

  const matches: QuestionMatch[] = [...assigned.entries()].map(
    ([questionId, blockIds]) => ({
      questionId,
      blockIds,
      basis: "label" as MatchBasis,
      confidence: 1,
    }),
  );

  const stillOpen = questions.filter((q) => !assigned.has(q.id));
  const orphanBlockIds: string[] = [];

  if (leftovers.length > 0 && stillOpen.length > 0) {
    try {
      const result = await generateJson<{
        matches: {
          blockId: string;
          questionId: string | null;
          confidence: number;
        }[];
      }>({
        system: SYSTEM,
        prompt: `Some answers on a student's sheet carry no usable question number. Decide which unanswered question each one belongs to, based on the subject matter.

UNANSWERED QUESTIONS:
${stillOpen
  .map((q) => `- id=${q.id} | ${q.displayNumber} | ${snippet(q.text, 200)}`)
  .join("\n")}

UNMATCHED ANSWERS:
${leftovers
  .map(
    (b) =>
      `- id=${b.id} | studentWroteLabel=${b.labelOnSheet ?? "none"} | ${snippet(b.transcription)}`,
  )
  .join("\n")}

Rules:
- Return one entry per unmatched answer, using its exact id.
- Set questionId to null when no question is a convincing fit. A stray answer with no matching question is a valid, expected outcome - do not force a match.
- confidence is 0 to 1. Use below 0.5 when you are unsure.
- Never assign the same question to two different answers.`,
        schema: SCHEMA,
        thinking: ThinkingLevel.MEDIUM,
      });

      const open = new Set(stillOpen.map((q) => q.id));
      const taken = new Set<string>();

      for (const m of result.matches ?? []) {
        const block = leftovers.find((b) => b.id === m.blockId);
        if (!block) continue;
        if (
          m.questionId &&
          open.has(m.questionId) &&
          !taken.has(m.questionId) &&
          m.confidence >= 0.35
        ) {
          taken.add(m.questionId);
          matches.push({
            questionId: m.questionId,
            blockIds: [block.id],
            basis: "semantic",
            confidence: m.confidence,
          });
        } else {
          orphanBlockIds.push(block.id);
        }
      }

      // Anything the model failed to mention is still unaccounted for.
      const reported = new Set((result.matches ?? []).map((m) => m.blockId));
      for (const block of leftovers) {
        if (!reported.has(block.id)) orphanBlockIds.push(block.id);
      }
    } catch {
      orphanBlockIds.push(...leftovers.map((b) => b.id));
    }
  } else {
    orphanBlockIds.push(...leftovers.map((b) => b.id));
  }

  const orphans = snapGroups(questions, blocks, matches, orphanBlockIds);

  const answered = new Set(matches.map((m) => m.questionId));
  return {
    matches,
    unansweredQuestionIds: questions
      .filter((q) => !answered.has(q.id))
      .map((q) => q.id),
    orphanBlockIds: orphans,
  };
}

/**
 * The parts of one written answer belong to one question's sub-parts, so once
 * any part has found its question the rest follow by marker. Without this a
 * group can end up half matched and half unmatched, which is exactly the case
 * a teacher then has to fix by hand.
 *
 * Mutates `matches`; returns the orphan ids that survive.
 */
export function snapGroups(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
  matches: QuestionMatch[],
  orphanBlockIds: string[],
): string[] {
  const groupIds = new Set(
    blocks.map((b) => b.groupId).filter((id): id is string => Boolean(id)),
  );
  if (groupIds.size === 0) return orphanBlockIds;

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const questionOfBlock = new Map<string, string>();
  for (const match of matches) {
    for (const blockId of match.blockIds) {
      questionOfBlock.set(blockId, match.questionId);
    }
  }

  const answered = new Set(matches.map((m) => m.questionId));
  const orphans = new Set(orphanBlockIds);

  for (const groupId of groupIds) {
    const parts = blocks.filter((b) => b.groupId === groupId);
    const anchor = parts
      .map((p) => questionOfBlock.get(p.id))
      .find((id): id is string => Boolean(id));
    const parentNumber = anchor
      ? questionById.get(anchor)?.parentNumber
      : null;
    if (!parentNumber) continue;

    for (const part of parts) {
      if (!orphans.has(part.id) || !part.partMarker) continue;
      const sibling = questions.find(
        (q) =>
          q.parentNumber === parentNumber &&
          q.subLabel === part.partMarker &&
          !answered.has(q.id),
      );
      if (!sibling) continue;
      answered.add(sibling.id);
      orphans.delete(part.id);
      matches.push({
        questionId: sibling.id,
        blockIds: [part.id],
        basis: "semantic",
        confidence: 0.6,
      });
    }
  }

  return [...orphans];
}
