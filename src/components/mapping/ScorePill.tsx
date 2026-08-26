import type { Verdict } from "@/lib/types";

/** Thresholds read off the Figma frame: 4/5 is green, 3/5 and 1/3 are amber,
 *  0/2 is red. */
function tone(awarded: number | null, total: number | null, verdict: Verdict) {
  if (verdict === "unanswered" || awarded === null || !total) return "danger";
  const ratio = awarded / total;
  if (ratio >= 0.8) return "success";
  if (ratio > 0) return "warning";
  return "danger";
}

const TONES = {
  success: "bg-success-tint/10 text-success",
  warning: "bg-warning-tint/10 text-warning",
  danger: "bg-danger-tint text-danger",
} as const;

export function ScorePill({
  awarded,
  total,
  verdict,
}: {
  awarded: number | null;
  total: number | null;
  verdict: Verdict;
}) {
  const shown = verdict === "unanswered" ? 0 : (awarded ?? 0);
  return (
    <span
      className={`t-p3-bold inline-flex h-[30px] shrink-0 items-center gap-1 rounded-pill px-3 ${TONES[tone(awarded, total, verdict)]}`}
    >
      {shown} / {total ?? 0}
    </span>
  );
}
