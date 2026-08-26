"use client";

import { isPdf, rasterize, stripDataUrlPrefix } from "./pdf";
import type { Progress, RunData } from "./store";
import type {
  AnswerBlock,
  ExtractedQuestion,
  GradingSummary,
  PageImage,
  QuestionResult,
  UploadedFile,
} from "./types";

const PAGES_PER_REQUEST = 4;

/** Each stage owns a slice of the bar so progress never jumps backwards. */
const SPAN = {
  reading: [0, 0.22],
  questions: [0.22, 0.45],
  answers: [0.45, 0.85],
  mapping: [0.85, 1],
} as const;

const lerp = (span: readonly [number, number], t: number) =>
  span[0] + (span[1] - span[0]) * Math.min(1, Math.max(0, t));

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    throw new Error(json.error ?? `Request to ${url} failed`);
  }
  return json as T;
}

const asPart = (page: PageImage) => ({
  mimeType: "image/jpeg",
  data: stripDataUrlPrefix(page.dataUrl),
});

export async function runPipeline(
  questionFile: UploadedFile,
  answerFile: UploadedFile,
  onProgress: (progress: Progress) => void,
): Promise<RunData> {
  onProgress({ stage: "reading", label: "Reading your files", value: 0.02 });

  // Only the answer sheet needs bitmaps — they back both the bounding boxes and
  // the on-screen viewer. A PDF question paper goes to the model untouched,
  // which is faster and keeps its vector text crisp.
  const answerPages = await rasterize(answerFile.file, (done, total) =>
    onProgress({
      stage: "reading",
      label: `Reading answer sheet — page ${done} of ${total}`,
      value: lerp(SPAN.reading, done / total),
    }),
  );

  onProgress({
    stage: "questions",
    label: "Extracting questions from the paper",
    value: SPAN.questions[0],
  });

  const questionParts = isPdf(questionFile.file)
    ? [
        {
          mimeType: "application/pdf",
          data: await fileToBase64(questionFile.file),
        },
      ]
    : (await rasterize(questionFile.file)).map(asPart);

  const { questions } = await postJson<{ questions: ExtractedQuestion[] }>(
    "/api/extract-questions",
    { pages: questionParts },
  );

  onProgress({
    stage: "answers",
    label: `Reading ${questions.length} questions · now reading the answers`,
    value: SPAN.answers[0],
  });

  const blocks: AnswerBlock[] = [];
  const batches: PageImage[][] = [];
  for (let i = 0; i < answerPages.length; i += PAGES_PER_REQUEST) {
    batches.push(answerPages.slice(i, i + PAGES_PER_REQUEST));
  }

  for (const [index, batch] of batches.entries()) {
    const first = batch[0].index + 1;
    const last = batch[batch.length - 1].index + 1;
    onProgress({
      stage: "answers",
      label: `Reading answers — page ${first}${last > first ? `–${last}` : ""} of ${answerPages.length}`,
      value: lerp(SPAN.answers, index / batches.length),
    });

    const { blocks: found } = await postJson<{ blocks: AnswerBlock[] }>(
      "/api/extract-answers",
      {
        pages: batch.map(asPart),
        pageNumbers: batch.map((p) => p.index + 1),
        totalPages: answerPages.length,
      },
    );
    blocks.push(...found);
  }

  onProgress({
    stage: "mapping",
    label: "Matching answers to questions and marking",
    value: SPAN.mapping[0],
  });

  const graded = await postJson<{
    results: QuestionResult[];
    summary: GradingSummary;
    orphanBlockIds: string[];
  }>("/api/map-and-grade", { questions, blocks });

  onProgress({ stage: "done", label: "Done", value: 1 });

  return {
    answerPages,
    questions,
    blocks,
    results: graded.results,
    summary: graded.summary,
    orphanBlockIds: graded.orphanBlockIds ?? [],
  };
}
