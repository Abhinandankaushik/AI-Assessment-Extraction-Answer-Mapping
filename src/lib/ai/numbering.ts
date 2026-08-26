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

/** Normalised key used to match a label written on an answer sheet ("Q11(a).")
 *  against a question number printed on the paper ("11 (a)"). */
export function numberKey(display: string): string {
  const { parentNumber, subLabel } = parseQuestionNumber(
    display.replace(/^\s*(?:q(?:uestion)?|ans(?:wer)?)\s*[.:-]?\s*/i, ""),
  );
  if (!parentNumber) return display.trim().toLowerCase();
  return subLabel ? `${parentNumber}${subLabel}` : parentNumber;
}
