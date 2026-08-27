"use client";

import { isPdf, rasterizeAll, stripDataUrlPrefix } from "./pdf";
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

/** Each stage owns a slice of the bar so progress never jumps backwards.
 *  Questions and answers share one slice because they are read concurrently. */
const SPAN = {
  reading: [0, 0.18],
  extracting: [0.18, 0.75],
  mapping: [0.75, 1],
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
  questionFiles: UploadedFile[],
  answerFiles: UploadedFile[],
  onProgress: (progress: Progress) => void,
): Promise<RunData> {
  onProgress({ stage: "reading", label: "Reading your files", value: 0.02 });

  // Only the answer sheet needs bitmaps — they back both the bounding boxes and
  // the on-screen viewer. A slot may be one PDF or a stack of page photos;
  // either way it flattens to a single renumbered page list.
  const answerPages = await rasterizeAll(
    answerFiles.map((f) => f.file),
    (done, total) =>
      onProgress({
        stage: "reading",
        label: `Reading answer sheet — page ${done} of ${total}`,
        value: lerp(SPAN.reading, done / total),
      }),
  );

  onProgress({
    stage: "questions",
    label: "Extracting questions from the paper",
    value: SPAN.extracting[0],
  });

  // A single PDF goes to the model untouched — faster, and its vector text
  // stays crisp. Anything else is rasterised first.
  const singlePdf =
    questionFiles.length === 1 && isPdf(questionFiles[0].file)
      ? questionFiles[0].file
      : null;

  const questionParts = singlePdf
    ? [{ mimeType: "application/pdf", data: await fileToBase64(singlePdf) }]
    : (await rasterizeAll(questionFiles.map((f) => f.file))).map(asPart);

  const batches: PageImage[][] = [];
  for (let i = 0; i < answerPages.length; i += PAGES_PER_REQUEST) {
    batches.push(answerPages.slice(i, i + PAGES_PER_REQUEST));
  }

  // Deliberately one request at a time. Running them together was quicker, but
  // a batch that meets a rate limit rolls to the next model on its own, so one
  // sheet could come back read by two models with two ideas of where a line
  // sits. Reading in order keeps a run internally consistent, which matters
  // more here than the minute it costs.
  const units = batches.length + 1;
  let done = 0;
  const step = (stage: Progress["stage"], label: string) => {
    done += 1;
    onProgress({ stage, label, value: lerp(SPAN.extracting, done / units) });
  };

  const { questions } = await postJson<{ questions: ExtractedQuestion[] }>(
    "/api/extract-questions",
    { pages: questionParts },
  );
  step("questions", `Found ${questions.length} questions`);

  const blocks: AnswerBlock[] = [];
  for (const batch of batches) {
    const first = batch[0].index + 1;
    const last = batch[batch.length - 1].index + 1;
    const pages = last > first ? `${first}–${last}` : `${first}`;
    onProgress({
      stage: "answers",
      label: `Reading answers on page ${pages}`,
      value: lerp(SPAN.extracting, done / units),
    });

    const result = await postJson<{ blocks: AnswerBlock[] }>(
      "/api/extract-answers",
      {
        pages: batch.map(asPart),
        pageNumbers: batch.map((p) => p.index + 1),
        totalPages: answerPages.length,
      },
    );
    blocks.push(...result.blocks);
    step("answers", `Read answers on page ${pages}`);
  }

  onProgress({
    stage: "mapping",
    label: "Matching answers to questions and marking",
    value: SPAN.mapping[0],
  });

  const graded = await postJson<{
    results: QuestionResult[];
    summary: GradingSummary;
    blocks?: AnswerBlock[];
    orphanBlockIds: string[];
  }>("/api/map-and-grade", { questions, blocks });

  onProgress({ stage: "done", label: "Done", value: 1 });

  return {
    answerPages,
    questions,
    // Mapping may have split an answer into its sub-parts, and the ids in
    // "results" point at those.
    blocks: graded.blocks ?? blocks,
    results: graded.results,
    summary: graded.summary,
    orphanBlockIds: graded.orphanBlockIds ?? [],
  };
}
