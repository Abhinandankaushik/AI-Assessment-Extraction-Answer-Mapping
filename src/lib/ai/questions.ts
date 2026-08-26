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
2. Treat every labelled sub-part as a SEPARATE entry. "11 (a)" and "11 (b)" are two questions, never one combined entry.
3. If a question has an unlabelled lead-in paragraph followed by labelled parts, attach the lead-in context to the FIRST labelled part and keep the parts separate.
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
  },
  required: ["missing", "spurious"],
} as const;

interface RawQuestion {
  displayNumber: string;
  text: string;
  marks?: number | null;
  page: number;
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
    }>({
      system: SYSTEM,
      prompt: `${RULES}

An earlier pass produced this list of displayNumbers:
${JSON.stringify(found.map((q) => q.displayNumber))}

Re-read the pages carefully and report:
- "missing": every question printed on the pages that is absent from that list (full entries). Pay special attention to labelled sub-parts, questions at page boundaries and questions in later sections.
- "spurious": any displayNumber in that list that is NOT actually printed on the pages.
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
  } catch {
    // The audit is an accuracy boost, not a hard requirement.
  }

  return audited.map((q, index) => {
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
