import { Type } from "@google/genai";
import type {
  AnswerBlock,
  ExtractedQuestion,
  GradingSummary,
  QuestionResult,
  Verdict,
} from "@/lib/types";
import { ThinkingLevel, generateJson } from "./client";
import type { MappingOutcome } from "./mapping";

const SYSTEM =
  "You are an experienced school teacher marking a Class 10 Science paper. " +
  "You mark what the student actually wrote, you award partial credit fairly, " +
  "and your feedback is one or two plain sentences a student can act on.";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    grades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.STRING },
          awarded: { type: Type.NUMBER },
          verdict: {
            type: Type.STRING,
            enum: ["correct", "partial", "incorrect"],
          },
          feedback: { type: Type.STRING },
        },
        required: ["questionId", "awarded", "verdict", "feedback"],
      },
    },
    overall: { type: Type.STRING },
  },
  required: ["grades", "overall"],
} as const;

const DEFAULT_MARKS = 1;

function snippet(text: string, max = 600): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Transcription noise is normal on handwriting, so the prompt tells the model
 *  to mark the intent rather than penalise OCR artefacts. */
function buildPrompt(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
  outcome: MappingOutcome,
): string {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const items = outcome.matches
    .map((match) => {
      const question = byId.get(match.questionId);
      if (!question) return null;
      const answer = match.blockIds
        .map((id) => blockById.get(id)?.transcription ?? "")
        .join(" ");
      return `---
id: ${question.id}
question (${question.displayNumber}, out of ${question.marks ?? DEFAULT_MARKS} marks): ${snippet(question.text, 400)}
student answer: ${snippet(answer)}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Mark each answer below.

${items}

Rules:
- "awarded" is a number from 0 to the marks stated for that question. Half marks are allowed.
- "verdict": "correct" for full marks, "partial" for some marks, "incorrect" for zero.
- The answers were transcribed from handwriting, so spelling slips, broken words and rough notation are transcription noise. Mark the intent, never the transcription quality.
- For a question asking for a diagram, accept a described diagram as evidence the student drew it.
- "feedback": one or two sentences addressed to the student. Say what earned the marks, or precisely what was missing.
- "overall": two or three sentences summarising performance across the whole paper - strengths, and the clearest gap to work on. Do not list every question.
- Return exactly one entry per id given, using that id verbatim.`;
}

export async function gradeAnswers(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
  outcome: MappingOutcome,
): Promise<{ results: QuestionResult[]; summary: GradingSummary }> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const graded = new Map<
    string,
    { awarded: number; verdict: Verdict; feedback: string }
  >();
  let overallText =
    "Answers were located and mapped, but marking could not be completed.";

  if (outcome.matches.length > 0) {
    try {
      const response = await generateJson<{
        grades: {
          questionId: string;
          awarded: number;
          verdict: Verdict;
          feedback: string;
        }[];
        overall: string;
      }>({
        system: SYSTEM,
        prompt: buildPrompt(questions, blocks, outcome),
        schema: SCHEMA,
        // Marking against a printed question is judgement, not deduction —
        // MEDIUM roughly doubled the wall clock for no visible gain.
        thinking: ThinkingLevel.LOW,
      });

      for (const g of response.grades ?? []) {
        const question = byId.get(g.questionId);
        if (!question) continue;
        const total = question.marks ?? DEFAULT_MARKS;
        graded.set(g.questionId, {
          awarded: Math.max(0, Math.min(total, g.awarded)),
          verdict: g.verdict,
          feedback: g.feedback,
        });
      }
      overallText = response.overall?.trim() || overallText;
    } catch {
      // Grading is additive: without it the mapping and highlighting still work.
    }
  }

  const results: QuestionResult[] = questions.map((question) => {
    const match = outcome.matches.find((m) => m.questionId === question.id);
    const total = question.marks ?? DEFAULT_MARKS;

    if (!match) {
      return {
        questionId: question.id,
        blockIds: [],
        matchBasis: "none",
        confidence: 0,
        awarded: 0,
        total,
        verdict: "unanswered",
        feedback: "This question was not attempted.",
      };
    }

    const grade = graded.get(question.id);
    return {
      questionId: question.id,
      blockIds: match.blockIds,
      matchBasis: match.basis,
      confidence: match.confidence,
      awarded: grade?.awarded ?? null,
      total,
      verdict: grade?.verdict ?? "partial",
      feedback: grade?.feedback ?? "Answer located, but it could not be marked.",
    };
  });

  const awarded = results.reduce((sum, r) => sum + (r.awarded ?? 0), 0);
  const total = results.reduce((sum, r) => sum + (r.total ?? 0), 0);

  return {
    results,
    summary: {
      awarded: Math.round(awarded * 2) / 2,
      total,
      answered: results.filter((r) => r.verdict !== "unanswered").length,
      unanswered: results.filter((r) => r.verdict === "unanswered").length,
      unmatched: outcome.orphanBlockIds.length,
      overall: overallText,
    },
  };
}
