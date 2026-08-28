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

/** Ordered so the mark is committed before the feedback justifying it, and so
 *  the closing summary is written after every question has been marked. */
const GRADE_ITEM = {
  type: Type.OBJECT,
  properties: {
    questionId: { type: Type.STRING },
    awarded: { type: Type.NUMBER },
    verdict: { type: Type.STRING, enum: ["correct", "partial", "incorrect"] },
    feedback: { type: Type.STRING },
  },
  propertyOrdering: ["questionId", "awarded", "verdict", "feedback"],
  required: ["questionId", "awarded", "verdict", "feedback"],
} as const;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    grades: { type: Type.ARRAY, items: GRADE_ITEM },
    overall: { type: Type.STRING, nullable: true },
  },
  propertyOrdering: ["grades", "overall"],
  required: ["grades"],
} as const;

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: { overall: { type: Type.STRING } },
  propertyOrdering: ["overall"],
  required: ["overall"],
} as const;

const DEFAULT_MARKS = 1;

const NOT_MARKED =
  "Answers were located and mapped, but marking could not be completed.";

/**
 * Marking is the slowest call in the run, and its cost is output tokens - two
 * sentences of feedback per question, written one after another. Splitting a
 * long paper keeps any single reply inside the output budget rather than
 * having it cut off mid-JSON.
 *
 * The threshold is deliberately high. Below it one request does everything,
 * including the closing summary; above it the chunks are marked one after
 * another and a separate, very short call writes the summary from the finished
 * marks. That costs one extra request, which only a paper long enough to need
 * the split should pay.
 */
const GRADES_PER_REQUEST = 16;

function snippet(text: string, max = 600): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Transcription noise is normal on handwriting, so the prompt tells the model
 *  to mark the intent rather than penalise OCR artefacts. */
function buildPrompt(
  questions: ExtractedQuestion[],
  blocks: AnswerBlock[],
  matches: MappingOutcome["matches"],
  withSummary: boolean,
): string {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const items = matches
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
- "feedback": one or two sentences addressed to the student. Say what earned the marks, or precisely what was missing.${
    withSummary
      ? '\n- "overall": two or three sentences summarising performance across the whole paper - strengths, and the clearest gap to work on. Do not list every question.'
      : ""
  }
- Return exactly one entry per id given, using that id verbatim.`;
}

/** Written from the finished marks rather than the answers, so it stays short
 *  and can be asked once for a paper graded in several parts. */
async function summarise(
  questions: ExtractedQuestion[],
  results: { questionId: string; awarded: number | null; total: number | null }[],
): Promise<string | null> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const lines = results
    .map((r) => {
      const question = byId.get(r.questionId);
      if (!question) return null;
      return `${question.displayNumber}: ${r.awarded ?? 0} of ${r.total ?? DEFAULT_MARKS} - ${snippet(question.text, 90)}`;
    })
    .filter(Boolean)
    .join("\n");

  try {
    const response = await generateJson<{ overall: string }>({
      system: SYSTEM,
      prompt: `Here is how one student scored across a whole paper.

${lines}

Write "overall": two or three sentences summarising their performance - strengths, and the clearest gap to work on. Address the student. Do not list every question.`,
      schema: SUMMARY_SCHEMA,
      thinking: ThinkingLevel.LOW,
    });
    return response.overall?.trim() || null;
  } catch {
    return null;
  }
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
  let overallText: string = NOT_MARKED;

  const chunks: MappingOutcome["matches"][] = [];
  for (let i = 0; i < outcome.matches.length; i += GRADES_PER_REQUEST) {
    chunks.push(outcome.matches.slice(i, i + GRADES_PER_REQUEST));
  }
  const asksForSummary = chunks.length === 1;

  // One at a time, like the reads: a chunk that meets a rate limit rolls to
  // another model, and half a paper marked to one standard and half to another
  // is not a mark sheet anybody should act on.
  const responses = [];
  for (const chunk of chunks) {
    responses.push(
      await generateJson<{
        grades: {
          questionId: string;
          awarded: number;
          verdict: Verdict;
          feedback: string;
        }[];
        overall?: string | null;
      }>({
        system: SYSTEM,
        prompt: buildPrompt(questions, blocks, chunk, asksForSummary),
        schema: SCHEMA,
        // Marking against a printed question is judgement, not deduction —
        // MEDIUM roughly doubled the wall clock for no visible gain.
        thinking: ThinkingLevel.LOW,
        // Grading is additive: without it the mapping and highlighting still
        // work, and one chunk failing must not cost the others theirs.
      }).catch(() => null),
    );
  }

  for (const response of responses) {
    for (const g of response?.grades ?? []) {
      const question = byId.get(g.questionId);
      if (!question) continue;
      const total = question.marks ?? DEFAULT_MARKS;
      graded.set(g.questionId, {
        awarded: Math.max(0, Math.min(total, g.awarded)),
        verdict: g.verdict,
        feedback: g.feedback,
      });
    }
    overallText = response?.overall?.trim() || overallText;
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

  // A paper graded in parts has no single call that saw all of it, so the
  // closing summary is written once from the finished marks. The same call
  // covers a single-chunk run whose response simply left "overall" out.
  if (graded.size > 0 && overallText === NOT_MARKED) {
    overallText = (await summarise(questions, results)) ?? overallText;
  }

  // A question whose marking failed has no mark, which is not the same as
  // scoring nothing: counting its total would quietly report the failure as a
  // zero the student never earned. An unattempted question keeps its 0.
  const marked = results.filter((r) => r.awarded !== null);
  const awarded = marked.reduce((sum, r) => sum + (r.awarded ?? 0), 0);
  const total = marked.reduce((sum, r) => sum + (r.total ?? 0), 0);

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
