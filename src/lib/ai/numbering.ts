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
 * A printed label stripped to its bare characters, so the same question written
 * "26 (b)", "26(b)" and "26 b" collapses to one key while "24 (b)(i)" and
 * "24 (b)(ii)" stay apart.
 */
export function compactLabel(display: string): string {
  return display.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const PREFIX = /^\s*(?:q(?:uestion)?|ans(?:wer)?)\s*[.:-]?\s*/i;

const SUB = String.raw`(?:\(\s*([a-z]{1,4})\s*\)|([a-z])\s*[.)])`;
const TWO_LEVEL = new RegExp(String.raw`^(\d+)\s*[.)]?\s*${SUB}\s*${SUB}`, "i");

/**
 * Normalised key matching a label written on an answer sheet ("Q11(a).")
 * against a question number printed on the paper ("11 (a)").
 *
 * Both levels of a nested label are kept, because a paper that prints
 * "24 (b)(i)" and "24 (b)(ii)" as separate questions needs separate keys - one
 * collapsed key would leave the second question permanently unmatchable.
 * {@link shallowKey} gives the one-level form for a paper that only prints
 * "24 (b)".
 */
export function numberKey(display: string): string {
  const cleaned = display.replace(PREFIX, "");
  const nested = cleaned.trim().match(TWO_LEVEL);
  if (nested) {
    const first = nested[2] ?? nested[3];
    const second = nested[4] ?? nested[5];
    return `${nested[1]}${first}${second}`.toLowerCase();
  }
  return shallowKey(display);
}

/** The key with any second-level sub-part dropped: "24 (b)(ii)" becomes "24b". */
export function shallowKey(display: string): string {
  const cleaned = display.replace(PREFIX, "");
  const { parentNumber, subLabel } = parseQuestionNumber(cleaned);
  if (!parentNumber) return display.trim().toLowerCase();
  return subLabel ? `${parentNumber}${subLabel}` : parentNumber;
}

/** The question a label belongs to, ignoring any sub-part: "Q.26)(a)" is "26". */
export function parentNumberOf(display: string): string | null {
  return parseQuestionNumber(display.replace(PREFIX, "")).parentNumber;
}

/**
 * The deepest sub-part marker in a label: "24 (b)(ii)" is "ii", "22 (a)" is "a".
 *
 * A bare "(ii)" written on the sheet has to be matched against whatever the
 * paper calls its innermost part, which is not always the level
 * {@link parseQuestionNumber} reports.
 */
export function lastSubPart(display: string): string | null {
  const cleaned = display.replace(PREFIX, "");
  const nested = cleaned.trim().match(TWO_LEVEL);
  if (nested) return (nested[4] ?? nested[5]).toLowerCase();
  return parseQuestionNumber(cleaned).subLabel;
}
