import fs from "node:fs";
import { createCanvas, Path2D as NapiPath2D, DOMMatrix as NapiDOMMatrix, ImageData as NapiImageData } from "@napi-rs/canvas";

globalThis.Path2D ??= NapiPath2D;
globalThis.DOMMatrix ??= NapiDOMMatrix;
globalThis.ImageData ??= NapiImageData;

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const [src, outDir, from, to, scaleArg] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(src));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;

for (let n = Number(from); n <= Math.min(Number(to), doc.numPages); n++) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Number(scaleArg || 1200 / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  fs.writeFileSync(`${outDir}/p${String(n).padStart(2, "0")}.jpg`, await canvas.encode("jpeg", 82));
  page.cleanup();
  console.log(`p${n} ${canvas.width}x${canvas.height}`);
}
