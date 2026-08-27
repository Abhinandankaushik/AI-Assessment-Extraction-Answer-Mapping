import { NextResponse } from "next/server";
import { gradeAnswers } from "@/lib/ai/grading";
import { mapAnswersToQuestions, materialiseParts } from "@/lib/ai/mapping";
import type { AnswerBlock, ExtractedQuestion } from "@/lib/types";

export const runtime = "nodejs";
// Measured on the 10-page sample: question extraction ~30s, each answer
// batch ~10-17s, mapping plus grading ~100s. 60s was not enough.
export const maxDuration = 300;

/** Mapping and grading share one round trip: both are text-only and the
 *  free-tier quota counts requests, not tokens. */
export async function POST(request: Request) {
  try {
    const { questions, blocks } = (await request.json()) as {
      questions?: ExtractedQuestion[];
      blocks?: AnswerBlock[];
    };

    if (!questions?.length) {
      return NextResponse.json(
        { error: "No extracted questions were provided" },
        { status: 400 },
      );
    }

    // Splitting an answer into its sub-parts needs the question paper, so it
    // happens here rather than during extraction. The caller gets the resulting
    // blocks back because every id in "results" refers to them.
    const parts = materialiseParts(questions, blocks ?? []);

    const outcome = await mapAnswersToQuestions(questions, parts);
    const { results, summary } = await gradeAnswers(questions, parts, outcome);

    return NextResponse.json({
      results,
      summary,
      blocks: parts,
      orphanBlockIds: outcome.orphanBlockIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mapping and grading failed";
    console.error("[map-and-grade]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
