import fs from "node:fs";
const pdf = fs.readFileSync("public/samples/class10_science_question_paper.pdf");
const started = Date.now();
const res = await fetch("http://localhost:3000/api/extract-questions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    pages: [{ mimeType: "application/pdf", data: pdf.toString("base64") }],
  }),
});
const json = await res.json();
console.log(`status ${res.status}  in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (json.questions) {
  console.log(`extracted ${json.questions.length} questions:\n`);
  for (const q of json.questions) {
    console.log(
      `  ${q.displayNumber.padEnd(9)} marks=${String(q.marks).padEnd(4)} p${q.page}  ${q.text.slice(0, 62)}...`,
    );
  }
} else {
  console.log(JSON.stringify(json, null, 2));
}
