import { NextResponse } from "next/server";
import { extractAnswersFromPages } from "@/lib/ai/answers";
import type { ImagePart } from "@/lib/ai/client";

export const runtime = "nodejs";
// Measured on the 10-page sample, individual calls run 10-30s and a long
// question paper read can reach 80s, so the 60s default was not enough.
// NOTE: 300 needs a paid Vercel plan; Hobby caps functions at 60s.
export const maxDuration = 300;

/** A batch of pages per request â€” the free-tier quota counts requests, not
 *  images, so batching is what keeps a public demo usable. */
export async function POST(request: Request) {
  try {
    const { pages, pageNumbers, totalPages } = (await request.json()) as {
      pages?: ImagePart[];
      pageNumbers?: number[];
      totalPages?: number;
    };

    if (!pages?.length) {
      return NextResponse.json(
        { error: "No answer-sheet pages were provided" },
        { status: 400 },
      );
    }

    const numbers =
      pageNumbers?.length === pages.length
        ? pageNumbers
        : pages.map((_, i) => i + 1);

    const blocks = await extractAnswersFromPages(
      pages,
      numbers,
      totalPages ?? numbers.length,
    );
    return NextResponse.json({ blocks });
  } catch (error) {
    // The stage is part of the message so the error screen says which step
    // of the run gave up, not just that something did.
    const message = `Reading the answer sheet: ${
      error instanceof Error ? error.message : "it failed"
    }`;
    console.error("[extract-answers]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
