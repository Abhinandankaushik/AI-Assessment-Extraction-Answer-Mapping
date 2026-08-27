# AI Assessment Extraction & Answer Mapping

Upload a question paper and a student's handwritten answer sheet. The app
extracts every question in printed order, reads the handwriting, works out which
answer belongs to which question, marks each one, and highlights the **exact
region of the sheet** the answer occupies.

Built to the provided Figma design — every colour, radius, spacing value and
type style was read out of the file's own Properties panel rather than eyeballed
(see [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md)).

- **Live URL:** _(add after deploy)_
- **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · zustand · pdf.js
- **AI:** Google Gemini (`gemini-3.5-flash`, with automatic fallback across
  `gemini-3.6-flash`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite`)

---

## Approach

The run is a four-pass pipeline. Passes 1, 2 and 4 talk to Gemini; the hard part
of pass 3 is deliberately plain code.

**1 · Question extraction**
The question paper goes to the model as-is when it is a PDF (crisper than
rasterising it first). A strict JSON schema forces one entry per question with
the printed numbering copied verbatim, so `11 (a)` and `11 (b)` come back as two
separate entries rather than one merged question.

A second **completeness audit** pass re-reads the same pages with the first
pass's list attached and reports anything missing or invented. Recovered
questions are spliced in next to their nearest printed neighbour, which keeps
the original reading order instead of blindly re-sorting.

**2 · Answer extraction with geometry**
The answer sheet is rasterised in the browser to one bitmap per page. Pages are
sent to the model **in batches**, and for each answer block it returns the label
the student wrote, a transcription, whether the block continues an answer from an
earlier page, and **one bounding box per written line** (normalised 0–1000).
The line boxes are unioned into the single tight rectangle the UI draws.

**3 · Mapping**
Answers that carry a written question number are matched **in plain code** by
normalising both sides (`Q.22)(a)` and `22 (a)` both reduce to `22a`). That is
exact, free, and stops the model from second-guessing a label the student wrote
themselves.

Two things decided in code rather than by the model do most of the work here:

*Where an answer ends.* A long answer often comes back as several blocks, only
the first of which carries the number. Text counts as a continuation when it
runs on directly under the answer above it, or when it opens the following page
— both measured from the bounding boxes, because the model's own
`continuesFromPrevPage` flag misses short fragments. Text that starts after a
gap, or partway down a fresh page, is left alone: that space is what a new
answer looks like. The same rule runs again after the semantic pass, so
fragments below an answer matched by content find their owner too.

*Whether an answer has sub-parts.* A student may write "(a)" and "(b)" under one
number, or number four observations "(i)" to "(iv)" inside a single answer.
These look identical on the page, so the split is decided against the question
paper: an answer is only broken apart when the paper prints a sub-question for
**every** marker in it. Otherwise it stays whole, and highlights and marks as one.

Only what is left over reaches the model, which matches by subject matter and is
explicitly allowed to return "no match".

**4 · Grading**
One text-only call marks every located answer out of its printed marks, returns
a verdict and one or two lines of feedback per question, plus an overall summary.
The prompt tells the model that transcription noise is expected and to mark the
student's intent, not the OCR quality.

## Edge cases

| Requirement | How it is handled |
| --- | --- |
| Every question, printed order | Extraction + audit pass; recovered items spliced positionally |
| `11 (a)` / `11 (b)` as separate entries | Enforced by schema and prompt, re-checked by the audit pass, with a conservative code-level splitter behind both |
| Answers written out of order | Matching is label-driven; sheet position is never assumed |
| Unanswered questions | No block → `unanswered`, shown greyed with a red `0 / N` pill |
| Answers matching no question | Collected into an **Unmatched answers** section under the list |
| Answers spanning pages | Continuations are detected from box geometry as well as the model's flag, within a page and across a page break; the viewer highlights every region and tags only the first |
| Sub-parts bundled into one printed question | Split into separate rows, with the shared stem repeated so each reads on its own; a multiple-choice option list is explicitly not treated as sub-parts |
| One written answer covering two sub-parts | Split at its "(a)"/"(b)" markers, each half with its own region — but only when the paper prints a sub-question for each |
| The same question found by two passes | Deduped on the bare characters of the label, so "26 (b)" and "26(b)" cannot both become rows |
| Exact region highlight | Normalised boxes re-projected as percentages over the rendered page |
| PDF **or images** | Either slot takes one PDF or a stack of page photos; images are ordered numerically (page2 before page10) and flattened into one renumbered page list |
| Processing progress | Real staged progress (`Reading → Questions → Answers → Mapping`) with a live bar |

## Running locally

```bash
npm install
cp .env.example .env.local     # then add your Gemini API key
npm run dev
```

Get a free key at <https://aistudio.google.com/apikey>.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run samples` | Regenerate the sample question paper PDF |
| `npm run illustration` | Rebuild the hero artwork from its capture |
| `npm test` | Unit tests for the numbering, geometry and mapping logic |

## Tests

`npm test` runs 69 unit tests over the pure functions where a mistake is silent
rather than loud: question-number normalisation, the union of line boxes into
the rectangle the UI draws, the deterministic label pass, the continuation
rules, and both sub-part splitters.

They pin the requirements that are easiest to regress — out-of-order answers,
multi-page answers, sub-parts, answers matching no question — and each one that
came out of a real run keeps its counter-case next to it: an answer is absorbed
when it runs on, and left alone when a gap says it is something new; a marker
list splits when the paper has parts for it, and does not when the paper has
none.

## Deploying

Any Next.js host works; this was built for Vercel.

```bash
vercel login
vercel link
vercel env add GEMINI_API_KEY production   # paste the key when prompted
vercel --prod
```

The key is only read at request time, so the build itself needs no secrets.
The AI routes declare `maxDuration = 300`. Measured on the 10-page sample:
question extraction ~30s, each batch of four answer pages 10-17s, and mapping
plus grading ~100s — about three minutes end to end.

## Sample files

`public/samples/` holds a matched pair used for testing:

- `class10_science_answer_sheet.pdf` — **a real scanned CBSE Class 10 answer
  sheet** (10 pages of genuine handwriting, no text layer, recompressed to
  1.6 MB).
- `class10_science_question_paper.pdf` — a CBSE-format paper **authored to match
  those answers**. It is not the original paper.

That pairing exercises every edge case with real data: `22 (b)` and `24 (a)` were
genuinely skipped by the student, questions 28–33 were never attempted, and four
answers run across page breaks.

## Assumptions and limitations

- **Free-tier quota is the real constraint.** Gemini's free tier allows roughly
  **20 requests per day per model**. A full run costs about five requests, so the
  app batches answer pages into one request each and falls back across four
  models when one is exhausted. When all four are spent the UI says so plainly
  instead of rendering an empty result.
- **Marking is indicative.** The model marks against the printed question, not an
  official marking scheme, so awarded marks are a teacher's starting point rather
  than a final grade.
- **Bounding boxes come from the model.** They are consistently tight on clean
  scans; a heavily skewed photograph will loosen them. The union-of-lines step
  and a small padding absorb most of that.
- Uploads are capped at 10 MB **per file**, matching the design. A slot holds
  either one PDF or any number of images — not a mix.
- Everything is in memory — no database, no auth, and a page refresh clears the
  run, which is the brief's stated expectation.
