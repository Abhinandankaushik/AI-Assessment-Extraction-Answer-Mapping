"use client";

import type { PageImage } from "./types";

/** pdf.js touches browser-only globals (DOMMatrix, Path2D) at module scope,
 *  so it must never be pulled in during SSR — always import it lazily. */
type PdfModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfModule> | null = null;

async function loadPdfjs(): Promise<PdfModule> {
  pdfjsPromise ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return mod;
  });
  return pdfjsPromise;
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function countPages(file: File): Promise<number> {
  if (!isPdf(file)) return 1;
  const pdfjsLib = await loadPdfjs();
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const pages = doc.numPages;
  await task.destroy();
  return pages;
}

/** Wide enough for the model to read handwriting (~180dpi on A4), small enough
 *  that a batch of pages stays inside the serverless request body limit once
 *  base64-encoded. */
const TARGET_WIDTH = 1500;
const QUALITY = 0.85;

function encode(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", QUALITY);
}

async function rasterizePdf(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  const pdfjsLib = await loadPdfjs();
  const task = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const pages: PageImage[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const scale = TARGET_WIDTH / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      // Scans are usually white; without this, transparent PDFs render black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      pages.push({
        index: n - 1,
        dataUrl: encode(canvas),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
      onPage?.(n, doc.numPages);
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

async function rasterizeImage(file: File): Promise<PageImage[]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, TARGET_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return [
    { index: 0, dataUrl: encode(canvas), width: canvas.width, height: canvas.height },
  ];
}

/** Turns a PDF or image upload into one bitmap per page. Every downstream
 *  bounding box is normalised against these dimensions. */
export async function rasterize(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  return isPdf(file) ? rasterizePdf(file, onPage) : rasterizeImage(file);
}

export function stripDataUrlPrefix(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
