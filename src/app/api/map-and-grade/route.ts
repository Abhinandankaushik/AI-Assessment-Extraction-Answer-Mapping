import { NextResponse } from "next/server";
import { gradeAnswers } from "@/lib/ai/grading";
import { mapAnswersToQuestions } from "@/lib/ai/mapping";
import type { AnswerBlock, ExtractedQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const outcome = await mapAnswersToQuestions(questions, blocks ?? []);
    const { results, summary } = await gradeAnswers(
      questions,
      blocks ?? [],
      outcome,
    );

    return NextResponse.json({
      results,
      summary,
      orphanBlockIds: outcome.orphanBlockIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mapping and grading failed";
    console.error("[map-and-grade]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
