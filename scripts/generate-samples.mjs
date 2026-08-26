import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { QUESTIONS, ANSWERS } from "./sample-data.mjs";

const OUT = path.join(process.cwd(), "public", "samples");
const A4 = [595.28, 841.89];
const INK = rgb(0.1, 0.12, 0.35);
const RULE = rgb(0.72, 0.78, 0.88);
const MARGIN_RED = rgb(0.85, 0.4, 0.42);

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildQuestionPaper() {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const margin = 56;
  const textLeft = margin + 42;
  const textWidth = A4[0] - textLeft - margin - 34;
  let page = doc.addPage(A4);
  let y = A4[1] - margin;

  const centre = (text, font, size, dy) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (A4[0] - w) / 2, y: y - dy, size, font, color: rgb(0, 0, 0) });
  };

  centre("DELHI PUBLIC SCHOOL, BOKARO STEEL CITY", bold, 14, 0);
  centre("Class X - Science (Biology) - Unit Test", body, 12, 20);
  centre("Time: 1 Hour", body, 10, 38);
  centre("Maximum Marks: 50", body, 10, 52);
  y -= 72;
  page.drawLine({
    start: { x: margin, y },
    end: { x: A4[0] - margin, y },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 28;

  page.drawText("Answer all questions. Draw diagrams wherever required.", {
    x: margin, y, size: 10, font: body, color: rgb(0.25, 0.25, 0.25),
  });
  y -= 26;

  for (const q of QUESTIONS) {
    const lines = wrap(q.text, body, 11.5, textWidth);
    const blockHeight = lines.length * 16 + 12;
    if (y - blockHeight < margin) {
      page = doc.addPage(A4);
      y = A4[1] - margin;
    }
    page.drawText(`${q.n}.`, { x: margin, y, size: 11.5, font: bold, color: rgb(0, 0, 0) });
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: textLeft, y: y - i * 16, size: 11.5, font: body, color: rgb(0, 0, 0),
      });
    });
    const marks = `[${q.marks}]`;
    page.drawText(marks, {
      x: A4[0] - margin - body.widthOfTextAtSize(marks, 11.5),
      y, size: 11.5, font: body, color: rgb(0, 0, 0),
    });
    y -= blockHeight;
  }

  fs.writeFileSync(path.join(OUT, "class10_science_question_paper.pdf"), await doc.save());
  return doc.getPageCount();
}

async function buildAnswerSheet() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let hand;
  try {
    hand = await doc.embedFont(
      fs.readFileSync("node_modules/@fontsource/caveat/files/caveat-latin-400-normal.woff"),
    );
  } catch {
    hand = await doc.embedFont(StandardFonts.TimesRomanItalic);
    console.warn("! handwriting font unavailable, using an italic fallback");
  }

  const LINE_H = 27;
  const TOP = A4[1] - 64;
  const BOTTOM = 64;
  const MARGIN_X = 74;

  const newPage = () => {
    const page = doc.addPage(A4);
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: rgb(0.992, 0.988, 0.965) });
    for (let ly = TOP; ly > BOTTOM; ly -= LINE_H) {
      page.drawLine({
        start: { x: 40, y: ly }, end: { x: A4[0] - 36, y: ly },
        thickness: 0.7, color: RULE,
      });
    }
    page.drawLine({
      start: { x: MARGIN_X, y: A4[1] - 30 }, end: { x: MARGIN_X, y: 30 },
      thickness: 0.9, color: MARGIN_RED,
    });
    return page;
  };

  let page = newPage();
  let y = TOP - 6;

  page.drawText("Name: Aarav Mehta      Roll No: 14      Class: X-B", {
    x: MARGIN_X + 10, y, size: 16, font: hand, color: INK,
  });
  y -= LINE_H * 2;

  for (const answer of ANSWERS) {
    // Force this answer to start near the foot of the page so it wraps onto
    // the next one - exercises the multi-page answer requirement.
    if (answer.spans && y > BOTTOM + LINE_H * 4) y = BOTTOM + LINE_H * 3;

    if (y < BOTTOM + LINE_H) {
      page = newPage();
      y = TOP - 6;
    }
    page.drawText(answer.label, { x: 30, y, size: 16, font: hand, color: INK });

    for (const line of answer.lines) {
      if (y < BOTTOM + LINE_H) {
        page = newPage();
        y = TOP - 6;
      }
      page.drawText(line, { x: MARGIN_X + 10, y, size: 16, font: hand, color: INK });
      y -= LINE_H;
    }
    y -= LINE_H * 0.6;
  }

  fs.writeFileSync(path.join(OUT, "student_answer_sheet.pdf"), await doc.save());
  return doc.getPageCount();
}

fs.mkdirSync(OUT, { recursive: true });
const qp = await buildQuestionPaper();
const as = await buildAnswerSheet();
console.log(`question paper : ${qp} pages`);
console.log(`answer sheet   : ${as} pages`);
