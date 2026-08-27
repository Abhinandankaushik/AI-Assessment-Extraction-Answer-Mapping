"use client";

import { ChevronDown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { ExtractedQuestion, QuestionResult } from "@/lib/types";
import { ScorePill } from "./ScorePill";

/** 32px circle, 2px white-25 ring and the two soft drop shadows from Figma.
 *  The active row swaps the fill to the brand orange. */
function Badge({ n, active }: { n: string; active: boolean }) {
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-pill border-2 border-white/25 text-[20px] leading-none font-extrabold tracking-[-0.04em] text-white"
      style={{
        backgroundColor: active ? "var(--color-brand)" : "rgb(43 43 43 / 0.8)",
        boxShadow: active
          ? "0 8px 8.8px 0 rgb(255 121 80 / 0.10)"
          : "0 4px 16px 0 rgb(67 67 67 / 0.10), 0 8px 8.8px 0 rgb(134 134 134 / 0.10)",
      }}
    >
      {n}
    </span>
  );
}

export function QuestionRow({
  question,
  result,
  active,
  expanded,
  onSelect,
  onToggle,
}: {
  question: ExtractedQuestion;
  result: QuestionResult | undefined;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const blocks = useAppStore((s) => s.blocks);
  const unanswered = result?.verdict === "unanswered";
  const transcript = (result?.blockIds ?? [])
    .map((id) => blocks.find((b) => b.id === id)?.transcription ?? "")
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return (
    <div
      className={`rounded-card bg-surface p-3 transition-[border-color,box-shadow] ${
        active ? "border-2 border-brand-soft" : "border-2 border-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-current={active ? "true" : undefined}
        >
          {/* The paper's own number, not the row position — sub-parts make the
              two diverge (11(a) and 11(b) are two rows but one printed 11). */}
          <Badge
            n={question.parentNumber ?? question.displayNumber}
            active={active}
          />
          <span className="min-w-0 flex-1 pt-1">
            <span className="t-p3 block text-ink">
              {question.subLabel && (
                <span className="font-bold">{question.subLabel}. </span>
              )}
              {question.text}
            </span>
            {unanswered && (
              <span className="t-p5 mt-1 block text-danger">Not attempted</span>
            )}
            {result?.matchBasis === "semantic" && (
              <span className="t-p5 mt-1 block text-warning">
                Matched by content, not by a written question number
              </span>
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <ScorePill
            awarded={result?.awarded ?? null}
            total={result?.total ?? question.marks}
            verdict={result?.verdict ?? "unanswered"}
          />
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide feedback" : "Show feedback"}
            className="grid size-8 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2"
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {expanded && result && (
        <div className="mt-3 rounded-card bg-surface-2 px-6 py-4">
          {/* What the model actually read, so a teacher can judge whether the
              mapping and the mark are trustworthy rather than taking both on
              faith. */}
          {transcript && (
            <>
              <p className="t-p3-bold text-ink">Student&rsquo;s answer</p>
              <p className="t-p5 mt-2 whitespace-pre-line text-ink">
                {transcript}
              </p>
              <hr className="my-3 border-surface-3" />
            </>
          )}
          <p className="t-p3-bold text-ink">AI Feedback</p>
          <p className="t-p5 mt-2 text-ink">{result.feedback}</p>
        </div>
      )}
    </div>
  );
}
