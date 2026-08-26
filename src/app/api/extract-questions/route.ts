import { NextResponse } from "next/server";
import { extractQuestions } from "@/lib/ai/questions";
import type { ImagePart } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pages?: ImagePart[] };
    const pages = body.pages ?? [];

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No question-paper pages were provided" },
        { status: 400 },
      );
    }

    const questions = await extractQuestions(pages);
    return NextResponse.json({ questions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Question extraction failed";
    console.error("[extract-questions]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
