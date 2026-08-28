# AI Assessment Extraction & Answer Mapping

Upload a question paper and a student's handwritten answer sheet. The app
extracts every question in printed order, reads the handwriting, works out which
answer belongs to which question, marks each one, and highlights the **exact
region of the sheet** the answer occupies.

Built to the provided Figma design — every colour, radius, spacing value and
type style was read out of the file's own Properties panel rather than eyeballed.

- **Live URL:** <https://veda-ai.devsh.online>
- **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · zustand · pdf.js
- **AI:** Google Gemini — `gemini-3.5-flash`, with automatic fallback across
  `gemini-3.6-flash`, `gemini-3-flash-preview` and `gemini-3.1-flash-lite` when
  a model hits its free-tier daily quota

---

## Approach

The run is a four-pass pipeline. Passes 1, 2 and 4 talk to Gemini. Pass 3 —
deciding which answer belongs to which question — makes **no model call at
all**; it is plain, deterministic code, and that is the point.

| Pass | In one line |
| --- | --- |
| **1 · Question extraction** | The paper goes to the model as a PDF, under a schema forcing one entry per printed number so `11 (a)` and `11 (b)` stay separate. A completeness-audit pass re-reads the pages against that list and splices anything missed back into reading order. |
| **2 · Answer extraction** | Pages are rasterised in the browser and sent in batches, each image captioned with its page number. Back comes the label the student wrote, a transcription, and one bounding box per written line. |
| **3 · Mapping** | Deterministic, no model. A written number opens a question and everything below belongs to it until the next number, across any number of page breaks. Labels resolve against the paper deepest-key-first, so an MCQ answer written `Q.9) (c)` lands on question 9 rather than a `9 (c)` the paper never printed. |
| **4 · Grading** | One text-only call marks each located answer out of its printed marks and returns a verdict, feedback, and an overall summary. |

In detail:

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
The line boxes are unioned into the single tight rectangle the UI draws, then
allowed to reach down to the whole-block box the model reports separately —
capped, and only downward, since that rescues a dropped last line without ever
dragging the highlight over the answer above.

Two details here decide whether a highlight lands on its handwriting at all, and
both were found by drawing the returned boxes back onto the page images:

- **Field order is enforced, not just documented.** The model has to transcribe
  a block in full before it places a single box; boxing as it reads puts every
  box on the line it just left. A schema's `properties` map promises nothing
  about order over the wire — `propertyOrdering` is what binds it.
- **Every image is captioned with its page number, inline, immediately before
  it.** Four scans of the same ruled notebook are near-identical, and a model
  asked afterwards which page a block came from has to count images. It
  miscounted: pages 3 and 4 came back swapped, so answers were drawn over other
  answers and reading order collapsed. Captioning makes page identity a local
  fact.

Locating handwriting is perception rather than deliberation, so this read sat at
the same low thinking level as the rest. That cost accuracy: on a page of worked
algebra with wide gaps between steps, the box for `Q.22) (a) Lamp A -> Power =
50W` landed five lines above the words, over the tail of the answer before it.
One level up puts it on the handwriting and tightens the boxes that were dropping
their last line, and on the sample batch it cost no wall clock at all.

**3 · Mapping**
No model call. Mapping is **entirely deterministic**, and that is the design,
not a shortcut: the student already wrote down which question they were
answering, and nothing available here is better evidence than that.

*Which question an answer names.* Both sides are normalised until they meet —
`Q.22)(a)` and `22 (a)` both reduce to `22a`. The number is read out of the
answer's own transcription rather than from a field beside it, so the number and
the words that came back with it cannot belong to different answers.

A written label is resolved deepest-first: the full key, then the key with the
innermost sub-part dropped, then the bare question number, then the first
unanswered sub-part under it. That last-but-one step is what makes
multiple-choice work. A student answering `Q.9) (c) 100% round and yellow` has
written the option they chose, not a sub-part address — the paper prints no
`9 (c)` for it to mean, so `9c` misses and `9` lands. Only the question paper
can tell those two apart, and only this pass has it.

*Where an answer ends.* A written number opens a question and everything below
belongs to it until the next number appears — however far down, across however
many page breaks. Within that run `(a)` opens a sub-part and holds until `(b)`.

Earlier versions were cleverer and worse. Geometry decided whether a fragment
continued the answer above it, and whatever fell through was handed to the model
to match on subject matter. Both failed in ways a teacher spots instantly: half
an answer highlighted because a gap was a millimetre too wide, and answers filed
under questions they were plainly not written for. Both were removed.

*Whether an answer has sub-parts.* A student may write "(a)" and "(b)" under one
number, or number four observations "(i)" to "(iv)" inside a single answer.
These look identical on the page, so the split is decided against the question
paper: an answer is only broken apart when the paper prints a sub-question for
**every** marker in it. Otherwise it stays whole, and highlights and marks as one.

Anything written before the first question number is reported as unmatched
rather than guessed at.

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
| A question showing a different answer's highlight | The worst failure this had. Clicking `26 (a)` outlined question `27 (b)`'s handwriting on another page, and `27 (b)` outlined a block covering 26's answer, the "Section-C" heading and 27 (a) — every row explaining itself as "matched by content, not by a written question number", on a sheet where the student had plainly written `Q.26)` and `Q.27)`. A label that failed to resolve fell through to a pass that guessed by subject matter, and it guessed badly. That pass is gone: what the student wrote decides, and a number that matches nothing is reported as unmatched rather than guessed at |
| A written marker the paper has no sub-part for | Resolved against the paper, deepest key first, so `Q.9) (c)` on a multiple-choice question lands on `9` rather than a `9 (c)` that does not exist |
| Unanswered questions | No block → `unanswered`, shown greyed with a red `0 / N` pill |
| Answers matching no question | Collected into an **Unmatched answers** section under the list |
| Answers spanning pages | A written number holds until the next one appears, across any number of page breaks; the viewer highlights every region and tags only the first |
| Sub-parts bundled into one printed question | Split into separate rows, with the shared stem repeated so each reads on its own; a multiple-choice option list is explicitly not treated as sub-parts |
| One written answer covering two sub-parts | Split at its "(a)"/"(b)" markers, each half with its own region — but only when the paper prints a sub-question for each |
| The same question found by two passes | Deduped on the bare characters of the label, so "26 (b)" and "26(b)" cannot both become rows |
| A number the student padded | `Q.09)` and a printed `9.` reduce to the same key; compared as raw strings they never met |
| Two answers run together in one block | A written question number always ends the block above it. Without that rule the model merged `Q.23` into the answer above it and `Q.25` into `24 (b)(ii)`, and both were reported unanswered while sitting on the page |
| The label read two different ways | The number is taken from the answer's own transcription, with the model's separate field kept as a second reading. A sheet saying `Q.24) (b)` came back transcribed `Q.24) (i)`; whichever reading names a question the paper actually prints is the one used |
| A page reported by position, not number | A number outside the batch that indexes into it is read as the position it plainly is. This one hides: the first batch is pages 1–4, where position and page number coincide, so a model reporting positions looks perfectly correct there and silently piles every later batch onto one page |
| A bounding box reported inverted or past the page | Normalised and clamped per box, so one bad line box neither vanishes from the union (shortening the highlight) nor stretches it across the page |
| A highlight stopping short of its answer | The region is the union of the model's per-line boxes, so when it returned fewer boxes than lines the highlight cut the last two or three lines off — the conclusion of a worked answer — and nothing in the code could tell. A separate whole-block box is now requested as well, and the union's foot is allowed to reach down to it: capped, and downward only, since a block box that drifted up would drag the highlight over the answer above |
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

`npm test` runs 109 unit tests over the pure functions where a mistake is silent
rather than loud: question-number normalisation, the union of line boxes into
the rectangle the UI draws, the deterministic label pass, page resolution within
a batch, and both sub-part splitters.

They pin the requirements that are easiest to regress — out-of-order answers,
multi-page answers, sub-parts, answers matching no question — and each one that
came out of a real run keeps its counter-case next to it: a marker list splits
when the paper has parts for it and does not when the paper has none; a written
`(c)` addresses a sub-part when the paper prints one and the question itself
when it does not.

Unit tests are not what settles this app, though. Whether a highlight sits on
its handwriting is only answerable by looking: rasterise the sample PDF, POST
the pages at the API routes, draw the returned boxes back onto the page images
and open them. Both geometry bugs above were found that way and neither was
visible in a passing test suite.

## Deploying

Running at <https://veda-ai.devsh.online> on **EC2 behind nginx, run by pm2**,
with a Let's Encrypt certificate. Any Node host works, but a
serverless one has to allow a long request: reading a dense question paper is a
single call that can run past 60s, which is where Vercel's Hobby tier cuts a
function off.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm i -g pm2

git clone <repo> app && cd app
npm ci
printf 'GEMINI_API_KEY=your_key_here\n' > .env.local   # leave GEMINI_MODELS unset
npm run build

pm2 start ecosystem.config.js
pm2 save && pm2 startup      # run the command it prints, so it survives a reboot
```

The key is only read at request time, so the build itself needs no secrets.
Use an instance with 2GB — `next build` will be killed on a 1GB box.

Two nginx defaults have to be raised, and both are silent when they are not:

```nginx
# Base64 inflates an upload by about a third, so the 10MB cap becomes a
# ~13.4MB body. The default is 1M, and it answers 413.
client_max_body_size 20M;

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Default is 60s — the same limit the move off serverless was to escape.
    proxy_connect_timeout 600s;
    proxy_send_timeout    600s;
    proxy_read_timeout    600s;
}
```

600s rather than the 300s a normal run needs, because two paths stack calls
inside a single request: a reply that comes back truncated is retried as two
half-sized batches, and a model that is out of quota rolls to the next of four.
Four fallbacks at 80s is already past 300 on its own.

If you add HTTPS with certbot afterwards, check both settings again: it rewrites
the config and can leave them behind in a block it no longer serves from.

`maxDuration = 300` in the API routes is a Vercel directive. It is ignored when
self-hosting and left in place so the app can still be deployed there.

To update: `git pull && npm ci && npm run build && pm2 restart veda`.

Requests go out **one at a time**, which is a deliberate trade. Running them
together was quicker, but a batch that meets a rate limit rolls to the next
model on its own — so one sheet could come back read by two models with two
ideas of where a line sits. Reading in order keeps a run internally consistent,
which matters more here than the couple of minutes it costs. A full run of the
10-page sample is around three minutes, and the request count is the same either
way.

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
  **20 requests per day per model**. A full run of the 10-page sample costs
  seven or eight, so the app batches four answer pages into each request and
  falls back across four models when one is exhausted. When all four are spent
  the UI says so plainly instead of rendering an empty result.
- **A run takes about three minutes**, and that is a choice. Requests are issued
  one at a time so a rate-limited batch cannot silently roll to a different
  model mid-sheet and come back with a different idea of where a line sits.
  Consistency was worth more here than the minutes.
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
