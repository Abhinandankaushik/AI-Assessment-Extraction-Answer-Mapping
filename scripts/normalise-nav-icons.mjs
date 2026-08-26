import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * The Figma exports came out on inconsistent canvases — the Assignments glyph
 * was a 14x18 mark sitting inside a 44x38 frame, so `mask-size: contain`
 * shrank it to a dot next to the others. Trim each to its alpha bounds and
 * re-centre it on a 20x20 box at natural size, which is the frame the nav
 * icons occupy in the design.
 */
const BOX = 20;
const DIR = path.join(process.cwd(), "public", "icons");
const FILES = [
  "nav-home",
  "nav-classroom",
  "nav-assignments",
  "nav-exams",
  "nav-library",
];

for (const name of FILES) {
  const file = path.join(DIR, `${name}.png`);
  const image = await loadImage(file);
  const source = createCanvas(image.width, image.height);
  const sctx = source.getContext("2d");
  sctx.drawImage(image, 0, 0);
  const data = sctx.getImageData(0, 0, image.width, image.height).data;

  let x0 = image.width;
  let y0 = image.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`${name} is empty`);

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // Never enlarge: a glyph already at or above the box keeps its own scale.
  const scale = Math.min(1, BOX / Math.max(w, h));
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);

  const out = createCanvas(BOX, BOX);
  const octx = out.getContext("2d");
  octx.drawImage(
    source,
    x0,
    y0,
    w,
    h,
    Math.round((BOX - dw) / 2),
    Math.round((BOX - dh) / 2),
    dw,
    dh,
  );

  fs.writeFileSync(file, await out.encode("png"));
  console.log(`${name.padEnd(18)} ${w}x${h} -> ${dw}x${dh} centred in ${BOX}x${BOX}`);
}
