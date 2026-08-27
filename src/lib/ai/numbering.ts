/** Splits a printed label such as "11 (a)" into its parent and sub-part. */
export function parseQuestionNumber(display: string): {
  parentNumber: string | null;
  subLabel: string | null;
} {
  const match = display
    .trim()
    .match(/^(\d+)\s*[.)]?\s*(?:\(\s*([a-z]{1,3})\s*\)|([a-z])\s*[.)])?/i);

  if (!match) return { parentNumber: null, subLabel: null };
  const sub = match[2] ?? match[3] ?? null;
  return {
    parentNumber: match[1] ?? null,
    subLabel: sub ? sub.toLowerCase() : null,
  };
}

/**
 * A label that is only a sub-part marker — "(b)", "ii)", "(iii)" — with no
 * question number in front of it. On an answer sheet this always refers back to
 * the numbered answer above, so the mapper resolves it by position rather than
 * by key.
 */
export function bareSubPart(label: string): string | null {
  // Restricted to plausible markers so a stray short word is never taken for one.
  const match = label
    .trim()
    .match(/^\(?\s*([a-h]|i{1,3}|iv|vi{0,3}|ix|x)\s*[).]?\s*$/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * The sub-part marker a line *opens* with — "(b) NaCl + AgNO3 …" is part (b).
 * Unlike {@link bareSubPart} the marker must be followed by real content, which
 * is what separates a new part from a line that merely starts with a stray letter.
 */
export function leadingSubPart(text: string): string | null {
  const match = text
    .trim()
    .match(/^\(?\s*([a-h]|i{1,3}|iv|vi{0,3}|ix|x)\s*\)\s*(?=\S)/i);
  return match ? match[1].toLowerCase() : null;
}

/** Normalised key used to match a label written on an answer sheet ("Q11(a).")
 *  against a question number printed on the paper ("11 (a)"). */
export function numberKey(display: string): string {
  const { parentNumber, subLabel } = parseQuestionNumber(
    display.replace(/^\s*(?:q(?:uestion)?|ans(?:wer)?)\s*[.:-]?\s*/i, ""),
  );
  if (!parentNumber) return display.trim().toLowerCase();
  return subLabel ? `${parentNumber}${subLabel}` : parentNumber;
}
