import { NextResponse } from "next/server";
import { extractQuestions } from "@/lib/ai/questions";
import type { ImagePart } from "@/lib/ai/client";

export const runtime = "nodejs";
// Measured on the 10-page sample, individual calls run 10-30s and a long
// question paper read can reach 80s, so the 60s default was not enough.
// NOTE: 300 needs a paid Vercel plan; Hobby caps functions at 60s.
export const maxDuration = 300;

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
    // The stage is part of the message so the error screen says which step
    // of the run gave up, not just that something did.
    const message = `Reading the question paper: ${
      error instanceof Error ? error.message : "it failed"
    }`;
    console.error("[extract-questions]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
