import { Type } from "@google/genai";
import type { ExtractedQuestion } from "@/lib/types";
import { ThinkingLevel, generateJson, type ImagePart } from "./client";
import { parseQuestionNumber } from "./numbering";

const SYSTEM =
  "You transcribe printed exam papers with forensic accuracy. You never invent, " +
  "merge, renumber, summarise or paraphrase. When unsure, you copy what is printed.";

const RULES = `
Extract EVERY question from these question-paper page images, in the exact order they are printed.

Hard rules:
1. Preserve the printed numbering VERBATIM in "displayNumber". If the paper prints "11 (a)", output "11 (a)" - not "11a", not "11".
2. Treat every labelled sub-part as a SEPARATE entry. "11 (a)" and "11 (b)" are two questions, never one combined entry. This holds even when the parts run on in the SAME paragraph or line as the question - "26. Write balanced equations for: (a) ... (b) ..." is TWO entries, "26 (a)" and "26 (b)", never one.
3. If a question has an unlabelled lead-in paragraph followed by labelled parts, repeat the lead-in at the start of EVERY part so each entry reads on its own, then keep the parts separate. Split the printed marks evenly across the parts.
3b. The lettered options of a multiple-choice question are NOT sub-parts. "(A) 4 (B) 6 (C) 8 (D) 10" is one question with its options, so keep it as ONE entry.
4. Copy question text verbatim. Do not shorten, clean up, or fix typos.
5. Never invent a question. Never skip one - including questions that continue across a page break.
6. Skip page headers, footers, school names, instructions, section headings and marks tables. Those are not questions.
7. "marks" is the number printed in brackets like [5] or "(5 marks)". Use null when no marks are printed.
8. "page" is the 1-based index of the page image the question STARTS on.
`.trim();

const QUESTION_ITEM = {
  type: Type.OBJECT,
  properties: {
    displayNumber: { type: Type.STRING },
    text: { type: Type.STRING },
    marks: { type: Type.INTEGER, nullable: true },
    page: { type: Type.INTEGER },
  },
  required: ["displayNumber", "text", "page"],
} as const;

const EXTRACT_SCHEMA = {
  type: Type.OBJECT,
  properties: { questions: { type: Type.ARRAY, items: QUESTION_ITEM } },
  required: ["questions"],
} as const;

const AUDIT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    missing: { type: Type.ARRAY, items: QUESTION_ITEM },
    spurious: { type: Type.ARRAY, items: { type: Type.STRING } },
    split: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          displayNumber: { type: Type.STRING },
          parts: { type: Type.ARRAY, items: QUESTION_ITEM },
        },
        required: ["displayNumber", "parts"],
      },
    },
  },
  required: ["missing", "spurious", "split"],
} as const;

interface RawQuestion {
  displayNumber: string;
  text: string;
  marks?: number | null;
  page: number;
}

/**
 * Last-resort split for a question that still bundles its sub-parts, e.g.
 * "Write balanced equations for: (a) ... (b) ...". The guards exist because a
 * multiple-choice option list looks identical to a regex: they keep it to
 * lowercase markers running a, b, c in order, on a question worth more than the
 * single mark an objective question carries, with a stem and real text in each
 * part. Anything less certain is left alone for the model's own judgement.
 */
export function splitInlineSubParts(q: RawQuestion): RawQuestion[] {
  const { subLabel } = parseQuestionNumber(q.displayNumber);
  if (subLabel) return [q];
  if (!q.marks || q.marks < 2) return [q];

  const markers = [...q.text.matchAll(/(?:^|[\s;:.])\(([a-h])\)\s(?=\S)/g)];
  if (markers.length < 2 || markers.length > 3) return [q];
  if (markers.some((m, i) => m[1] !== String.fromCharCode(97 + i))) return [q];

  const stem = q.text.slice(0, markers[0].index).trim();
  if (stem.length < 10) return [q];

  const parts = markers.map((marker, i) => {
    const from = marker.index + marker[0].length;
    const to = markers[i + 1]?.index ?? q.text.length;
    return { letter: marker[1], body: q.text.slice(from, to).trim() };
  });
  if (parts.some((p) => p.body.length < 15)) return [q];

  const { parentNumber } = parseQuestionNumber(q.displayNumber);
  return parts.map((part) => ({
    displayNumber: `${parentNumber ?? q.displayNumber.trim()} (${part.letter})`,
    text: `${stem} ${part.body}`.trim(),
    marks: q.marks ? q.marks / parts.length : null,
    page: q.page,
  }));
}

/** Sort key that mirrors how a paper is actually laid out. */
function rank(q: RawQuestion): [number, number, number] {
  const { parentNumber, subLabel } = parseQuestionNumber(q.displayNumber);
  return [
    q.page,
    parentNumber ? Number.parseInt(parentNumber, 10) : Number.MAX_SAFE_INTEGER,
    subLabel ? subLabel.charCodeAt(0) : 0,
  ];
}

function isBefore(a: RawQuestion, b: RawQuestion): boolean {
  const [ap, an, as] = rank(a);
  const [bp, bn, bs] = rank(b);
  if (ap !== bp) return ap < bp;
  if (an !== bn) return an < bn;
  return as < bs;
}

/**
 * A single pass reliably misses questions on dense papers, so a second
 * "what did you miss?" pass runs against the same images and its finds are
 * spliced in next to their nearest printed neighbour — which keeps the
 * original reading order intact instead of blindly re-sorting.
 */
export async function extractQuestions(
  images: ImagePart[],
): Promise<ExtractedQuestion[]> {
  const first = await generateJson<{ questions: RawQuestion[] }>({
    system: SYSTEM,
    prompt: RULES,
    images,
    schema: EXTRACT_SCHEMA,
    thinking: ThinkingLevel.LOW,
  });

  const found = first.questions ?? [];
  const seen = new Set(found.map((q) => q.displayNumber.trim().toLowerCase()));

  let audited = found;
  try {
    const audit = await generateJson<{
      missing: RawQuestion[];
      spurious: string[];
      split: { displayNumber: string; parts: RawQuestion[] }[];
    }>({
      system: SYSTEM,
      prompt: `${RULES}

An earlier pass produced this list of displayNumbers:
${JSON.stringify(found.map((q) => q.displayNumber))}

Re-read the pages carefully and report:
- "missing": every question printed on the pages that is absent from that list (full entries). Pay special attention to labelled sub-parts, questions at page boundaries and questions in later sections.
- "spurious": any displayNumber in that list that is NOT actually printed on the pages.
- "split": any entry in that list that bundles two or more printed sub-parts into one question, together with the separate entries it should become. Judge this by what the paper prints: "(a)" and "(b)" that ask for different work are sub-parts and must be split; the lettered options of a multiple-choice question are alternatives to one question and must NOT be split.
Return empty arrays if the list is already correct.`,
      images,
      schema: AUDIT_SCHEMA,
      thinking: ThinkingLevel.LOW,
    });

    const spurious = new Set(
      (audit.spurious ?? []).map((s) => s.trim().toLowerCase()),
    );
    audited = found.filter(
      (q) => !spurious.has(q.displayNumber.trim().toLowerCase()),
    );

    for (const item of audit.missing ?? []) {
      const key = item.displayNumber.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let at = audited.length;
      for (let i = 0; i < audited.length; i++) {
        if (isBefore(item, audited[i])) {
          at = i;
          break;
        }
      }
      audited.splice(at, 0, item);
    }

    for (const group of audit.split ?? []) {
      const key = group.displayNumber.trim().toLowerCase();
      const at = audited.findIndex(
        (q) => q.displayNumber.trim().toLowerCase() === key,
      );
      if (at === -1 || (group.parts ?? []).length < 2) continue;
      audited.splice(at, 1, ...group.parts);
    }
  } catch {
    // The audit is an accuracy boost, not a hard requirement.
  }

  return audited.flatMap(splitInlineSubParts).map((q, index) => {
    const { parentNumber, subLabel } = parseQuestionNumber(q.displayNumber);
    return {
      id: `q${index + 1}`,
      displayNumber: q.displayNumber.trim(),
      parentNumber,
      subLabel,
      text: q.text.trim(),
      marks: q.marks ?? null,
      page: Math.max(1, q.page || 1),
      orderIndex: index,
    };
  });
}
