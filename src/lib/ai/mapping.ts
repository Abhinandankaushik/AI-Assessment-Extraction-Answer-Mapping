import { Type } from "@google/genai";
import type {
  AnswerBlock,
  ExtractedQuestion,
  MatchBasis,
} from "@/lib/types";
import { ThinkingLevel, generateJson } from "./client";
import { numberKey } from "./numbering";

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

/**
 * Answers that carry a written question number are matched in plain code —
 * that is both exact and free. Only the leftovers reach the model, which keeps
 * the request count (and therefore the free-tier quota) down and stops the
 * model from second-guessing a label the student wrote themselves.
 */
function matchByLabel(
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

  for (const block of blocks) {
    if (block.labelOnSheet) {
      const key = numberKey(block.labelOnSheet);
      const questionId = byKey.get(key);
      if (questionId) {
        push(questionId, block.id);
        currentQuestionId = questionId;
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

    // Unlabelled continuation of the answer immediately above it — this is how
    // an answer that runs over a page break stays attached to its question.
    if (block.continuesFromPrevPage && currentQuestionId) {
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

  const answered = new Set(matches.map((m) => m.questionId));
  return {
    matches,
    unansweredQuestionIds: questions
      .filter((q) => !answered.has(q.id))
      .map((q) => q.id),
    orphanBlockIds,
  };
}
