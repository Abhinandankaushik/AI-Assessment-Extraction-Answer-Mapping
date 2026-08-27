"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { GradingSummary } from "@/lib/types";
import { QuestionRow } from "./QuestionRow";

/** The brief asks a teacher to *quickly* see what was left unanswered, so the
 *  summary counts double as filters rather than being read-only stats. */
type Filter = "all" | "answered" | "unanswered" | "unmatched";

function Chip({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "success" | "danger" | "warning";
  children: React.ReactNode;
}) {
  const tones = {
    success: "bg-success-tint/10 text-success",
    danger: "bg-danger-tint text-danger",
    warning: "bg-warning-tint/10 text-warning",
  } as const;
  const rings = {
    success: "ring-success",
    danger: "ring-danger",
    warning: "ring-warning",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`t-p5 rounded-pill px-3 py-1 transition-all ${tones[tone]} ${
        active ? `ring-2 ring-offset-1 ${rings[tone]}` : "hover:brightness-95"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({
  summary,
  filter,
  onFilter,
}: {
  summary: GradingSummary;
  filter: Filter;
  onFilter: (next: Filter) => void;
}) {
  const percent = summary.total
    ? Math.round((summary.awarded / summary.total) * 100)
    : 0;

  const toggle = (value: Filter) => onFilter(filter === value ? "all" : value);

  return (
    <div className="rounded-card bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-[28px] leading-none font-extrabold tracking-[-0.04em] text-dark">
            {summary.awarded}
            <span className="text-muted"> / {summary.total}</span>
          </p>
          <p className="t-p5 mt-1 text-muted">{percent}% overall</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip
            tone="success"
            active={filter === "answered"}
            onClick={() => toggle("answered")}
          >
            {summary.answered} answered
          </Chip>
          <Chip
            tone="danger"
            active={filter === "unanswered"}
            onClick={() => toggle("unanswered")}
          >
            {summary.unanswered} unanswered
          </Chip>
          {summary.unmatched > 0 && (
            <Chip
              tone="warning"
              active={filter === "unmatched"}
              onClick={() => toggle("unmatched")}
            >
              {summary.unmatched} unmatched
            </Chip>
          )}
        </div>
      </div>
      {summary.overall && (
        <p className="t-p5 mt-3 border-t border-surface-3 pt-3 text-ink">
          {summary.overall}
        </p>
      )}
    </div>
  );
}

function UnmatchedAnswers() {
  const { blocks, orphanBlockIds } = useAppStore();
  const orphans = blocks.filter((b) => orphanBlockIds.includes(b.id));
  if (orphans.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="t-p3-bold px-1 text-ink">
        Unmatched answers ({orphans.length})
      </h3>
      <p className="t-p5 mt-1 mb-3 px-1 text-muted">
        Written on the sheet but not matching any question on the paper.
      </p>
      <div className="flex flex-col gap-2">
        {orphans.map((block) => (
          <div key={block.id} className="rounded-card bg-surface p-3">
            <p className="t-p5 text-muted">
              {block.labelOnSheet
                ? `Labelled “${block.labelOnSheet}”`
                : "No label written"}{" "}
              · page {block.regions[0]?.page}
            </p>
            <p className="t-p5 mt-1 line-clamp-3 text-ink">
              {block.transcription}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function QuestionList() {
  const { questions, results, summary, selectedQuestionId, selectQuestion } =
    useAppStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  const resultById = useMemo(
    () => new Map(results.map((r) => [r.questionId, r])),
    [results],
  );

  const visible = useMemo(() => {
    if (filter === "unmatched") return [];
    if (filter === "all") return questions;
    const wantUnanswered = filter === "unanswered";
    return questions.filter(
      (q) =>
        (resultById.get(q.id)?.verdict === "unanswered") === wantUnanswered,
    );
  }, [questions, resultById, filter]);

  const allExpanded = expanded.size === questions.length && questions.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="t-p3-bold text-ink">
          Extracted Questions{" "}
          <span className="hidden sm:inline">(from question paper)</span>
        </h2>
        <button
          type="button"
          onClick={() =>
            setExpanded(
              allExpanded ? new Set() : new Set(questions.map((q) => q.id)),
            )
          }
          className="t-p4 h-11 shrink-0 rounded-btn border-2 border-white/15 bg-white pr-5 pl-4 text-btn transition-transform active:scale-[0.98]"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-4">
        {summary && (
          <SummaryCard
            summary={summary}
            filter={filter}
            onFilter={setFilter}
          />
        )}

        {filter !== "all" && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-card bg-surface-2 px-4 py-2">
            <p className="t-p5 text-ink">
              Showing {filter === "unmatched" ? "unmatched answers" : filter}{" "}
              only
            </p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="t-p5 text-brand hover:underline"
            >
              Show all
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {visible.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              result={resultById.get(question.id)}
              active={selectedQuestionId === question.id}
              expanded={expanded.has(question.id)}
              onSelect={() => selectQuestion(question.id)}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(question.id)) next.delete(question.id);
                  else next.add(question.id);
                  return next;
                })
              }
            />
          ))}
        </div>

        {filter !== "answered" && <UnmatchedAnswers />}
      </div>
    </div>
  );
}
