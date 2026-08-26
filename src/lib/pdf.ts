"use client";

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
