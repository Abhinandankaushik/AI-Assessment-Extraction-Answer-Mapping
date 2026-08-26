import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * The hero illustration was captured from Figma against the page background.
 * Flood-fill that neutral grey away from the edges so the artwork can sit on
 * the app's gradient, then trim to the artwork's bounding box.
 *
 * The discriminator is saturation, not lightness: the page grey is neutral
 * (R ~= G ~= B) while the lightest peach ring still reads about 20 units
 * warmer on red than on blue.
 */
const SRC = path.join(process.cwd(), "scripts/assets/raw-teacher.png");
const OUT = path.join(process.cwd(), "public/illustrations/teacher.png");

const image = await loadImage(SRC);
const { width, height } = image;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
ctx.drawImage(image, 0, 0);

const pixels = ctx.getImageData(0, 0, width, height);
const data = pixels.data;
const at = (x, y) => (y * width + x) * 4;

const isNeutralGrey = (i) => {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return Math.max(r, g, b) - Math.min(r, g, b) < 12 && r > 190;
};

const background = new Uint8Array(width * height);
const stack = [];
for (let x = 0; x < width; x++) {
  stack.push([x, 0], [x, height - 1]);
}
for (let y = 0; y < height; y++) {
  stack.push([0, y], [width - 1, y]);
}

while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= width || y >= height) continue;
  const flat = y * width + x;
  if (background[flat]) continue;
  const i = at(x, y);
  if (!isNeutralGrey(i)) continue;
  background[flat] = 1;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

for (let i = 0, p = 0; p < background.length; p++, i += 4) {
  if (background[p]) data[i + 3] = 0;
}

// One-pixel alpha ramp so the cut edge does not look stamped on.
const softened = Uint8ClampedArray.from(data);
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const flat = y * width + x;
    if (background[flat]) continue;
    const touchesBackground =
      background[flat - 1] ||
      background[flat + 1] ||
      background[flat - width] ||
      background[flat + width];
    if (touchesBackground) softened[at(x, y) + 3] = 150;
  }
}
pixels.data.set(softened);
ctx.putImageData(pixels, 0, 0);

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (softened[at(x, y) + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const size = Math.max(maxX - minX + 1, maxY - minY + 1);
const trimmed = createCanvas(size, size);
const tctx = trimmed.getContext("2d");
tctx.drawImage(
  canvas,
  minX,
  minY,
  maxX - minX + 1,
  maxY - minY + 1,
  Math.round((size - (maxX - minX + 1)) / 2),
  Math.round((size - (maxY - minY + 1)) / 2),
  maxX - minX + 1,
  maxY - minY + 1,
);

const out = await trimmed.encode("png");
fs.writeFileSync(OUT, out);
const cleared = background.reduce((n, v) => n + v, 0);
console.log(
  `teacher.png ${size}x${size}, ${(out.length / 1024).toFixed(0)} KB, ` +
    `${((cleared / (width * height)) * 100).toFixed(1)}% of the capture removed`,
);
