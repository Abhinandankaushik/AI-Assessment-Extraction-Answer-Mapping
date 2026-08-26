import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SECTIONS } from "./sample-data.mjs";

const A4 = [595.28, 841.89];
const MARGIN = 52;
const NUM_COL = 46;
const MARKS_COL = 30;
const BODY = 10.5;
const LEAD = 14;
const BLACK = rgb(0, 0, 0);

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

const doc = await PDFDocument.create();
const body = await doc.embedFont(StandardFonts.TimesRoman);
const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

const textLeft = MARGIN + NUM_COL;
const textWidth = A4[0] - textLeft - MARGIN - MARKS_COL;

let page = doc.addPage(A4);
let y = A4[1] - MARGIN;

function newPage() {
  page = doc.addPage(A4);
  y = A4[1] - MARGIN;
}

function ensure(height) {
  if (y - height < MARGIN + 10) newPage();
}

function centre(text, font, size, gap) {
  y -= gap;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4[0] - w) / 2, y, size, font, color: BLACK });
}

centre("CENTRAL BOARD OF SECONDARY EDUCATION", bold, 13, 0);
centre("SECONDARY SCHOOL EXAMINATION", body, 11, 17);
centre("SCIENCE - 086", bold, 15, 22);
centre("Class X", body, 11, 20);
y -= 20;
page.drawText("Time Allowed: 3 Hours", { x: MARGIN, y, size: 10, font: body, color: BLACK });
const mm = "Maximum Marks: 80";
page.drawText(mm, {
  x: A4[0] - MARGIN - body.widthOfTextAtSize(mm, 10),
  y, size: 10, font: body, color: BLACK,
});
y -= 12;
page.drawLine({
  start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y },
  thickness: 0.9, color: rgb(0.2, 0.2, 0.2),
});
y -= 20;

page.drawText("General Instructions: All questions are compulsory. Draw neat diagrams wherever necessary.", {
  x: MARGIN, y, size: 9.5, font: body, color: rgb(0.25, 0.25, 0.25),
});
y -= 26;

for (const section of SECTIONS) {
  ensure(52);
  const w = bold.widthOfTextAtSize(section.title, 12);
  page.drawText(section.title, { x: (A4[0] - w) / 2, y, size: 12, font: bold, color: BLACK });
  y -= 15;
  const nw = body.widthOfTextAtSize(section.note, 9);
  page.drawText(section.note, {
    x: (A4[0] - nw) / 2, y, size: 9, font: body, color: rgb(0.3, 0.3, 0.3),
  });
  y -= 22;

  for (const q of section.questions) {
    const lines = wrap(q.text, body, BODY, textWidth);
    ensure(lines.length * LEAD + 12);

    page.drawText(`${q.n}.`, { x: MARGIN, y, size: BODY, font: bold, color: BLACK });
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: textLeft, y: y - i * LEAD, size: BODY, font: body, color: BLACK,
      });
    });
    const marks = `[${q.marks}]`;
    page.drawText(marks, {
      x: A4[0] - MARGIN - body.widthOfTextAtSize(marks, BODY),
      y, size: BODY, font: body, color: BLACK,
    });
    y -= lines.length * LEAD + 12;
  }
  y -= 8;
}

const dir = path.join(process.cwd(), "public", "samples");
fs.mkdirSync(dir, { recursive: true });
const bytes = await doc.save();
fs.writeFileSync(path.join(dir, "class10_science_question_paper.pdf"), bytes);
console.log(
  `question paper: ${doc.getPageCount()} pages, ${SECTIONS.flatMap((s) => s.questions).length} questions, ${(bytes.length / 1024).toFixed(0)} KB`,
);
