import fs from "node:fs";
import path from "node:path";
import { createCanvas, Path2D as P2D, DOMMatrix as DM, ImageData as ID } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";

globalThis.Path2D ??= P2D;
globalThis.DOMMatrix ??= DM;
globalThis.ImageData ??= ID;

const SRC = process.argv[2];
const FROM = Number(process.argv[3] ?? 2);
const TO = Number(process.argv[4] ?? 11);
const WIDTH = 1500;
const QUALITY = 72;

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(SRC)),
  useSystemFonts: true,
  isEvalSupported: false,
}).promise;

const out = await PDFDocument.create();

for (let n = FROM; n <= Math.min(TO, doc.numPages); n++) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: WIDTH / base.width });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();

  const jpg = await canvas.encode("jpeg", QUALITY);
  const img = await out.embedJpg(jpg);
  const p = out.addPage([img.width, img.height]);
  p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  process.stdout.write(`p${n} `);
}

const dir = path.join(process.cwd(), "public", "samples");
fs.mkdirSync(dir, { recursive: true });
const bytes = await out.save();
fs.writeFileSync(path.join(dir, "class10_science_answer_sheet.pdf"), bytes);
console.log(`\nanswer sheet: ${out.getPageCount()} pages, ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
