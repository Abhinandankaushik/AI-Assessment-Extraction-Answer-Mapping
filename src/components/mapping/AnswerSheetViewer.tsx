"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { highlightBands } from "@/lib/highlight";
import { useAppStore } from "@/lib/store";
import type { AnswerBlock, AnswerRegion } from "@/lib/types";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Every block the model located, drawn exactly where it said, with the number
 * it read there. Nothing corrects or snaps these — that is the point: they show
 * what the extraction actually returned, so a box sitting a line off its
 * handwriting is visible instead of being inferred from a wrong highlight.
 *
 * Development only. A real run has to be on screen for it to show anything, so
 * it lives here as a toggle rather than a route of its own.
 */
const INSPECTABLE = process.env.NODE_ENV !== "production";

/** Drops the punctuation a label trails — "25." and "26)" become "25" and "26"
 *  — while leaving a bracketed sub-part like "22 (a)" intact. */
function trimLabel(label: string): string {
  return label
    .trim()
    .replace(/[\s.]+$/, "")
    .replace(/^([^()]*)\)$/, "$1");
}

/**
 * `offsetTop` is measured against the nearest *positioned* ancestor, which here
 * is the app shell rather than this scroller — using it sent the view past the
 * answer. Measuring through rects is correct no matter what is positioned.
 */
function topWithinScroller(container: HTMLElement, el: HTMLElement): number {
  return (
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  );
}

export function AnswerSheetViewer() {
  const {
    answerPages,
    blocks,
    results,
    questions,
    selectedQuestionId,
    selectedBlockId,
  } = useAppStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [currentPage, setCurrentPage] = useState(1);
  const [inspecting, setInspecting] = useState(false);

  const zoom = ZOOM_STEPS[zoomIndex];

  const selected = useMemo(() => {
    // An unmatched answer has no question to name it, so it is tagged with what
    // the student wrote and drawn in the warning colour its card already uses.
    if (selectedBlockId) {
      const block = blocks.find((b) => b.id === selectedBlockId);
      if (!block) return null;
      const written = block.labelOnSheet && trimLabel(block.labelOnSheet);
      return {
        label: written ? `${written} · unmatched` : "Unmatched",
        regions: highlightBands(blocks, block.regions),
        tone: "unmatched" as const,
      };
    }
    if (!selectedQuestionId) return null;
    const result = results.find((r) => r.questionId === selectedQuestionId);
    if (!result || result.blockIds.length === 0) return null;
    const question = questions.find((q) => q.id === selectedQuestionId);
    const regions = result.blockIds.flatMap(
      (id) => blocks.find((b) => b.id === id)?.regions ?? [],
    );
    // Papers print "25." or "22 (a)"; the tag reads better as Q25 / Q22 (a).
    const printed = question && trimLabel(question.displayNumber);
    return {
      label: printed ? `Q${printed}` : "",
      regions: highlightBands(blocks, regions),
      tone: "matched" as const,
    };
  }, [selectedBlockId, selectedQuestionId, results, questions, blocks]);

  const accent =
    selected?.tone === "unmatched"
      ? {
          line: "var(--color-warning)",
          fill: "rgb(227 96 15 / 0.10)",
          tag: "var(--color-warning)",
        }
      : {
          line: "var(--color-hl-border)",
          fill: "rgb(94 255 53 / 0.10)",
          tag: "var(--color-success)",
        };

  // An answer that spans several regions is still one answer: tagging every
  // rectangle stacks labels on top of each other and buries the handwriting.
  const firstRegion = useMemo(
    () =>
      selected?.regions
        .slice()
        .sort((x, y) => x.page - y.page || x.box.y - y.box.y)[0] ?? null,
    [selected],
  );

  const rawByPage = useMemo(() => {
    const map = new Map<number, { block: AnswerBlock; region: AnswerRegion }[]>();
    if (!inspecting) return map;
    for (const block of blocks) {
      for (const region of block.regions) {
        map.set(region.page, [...(map.get(region.page) ?? []), { block, region }]);
      }
    }
    return map;
  }, [inspecting, blocks]);

  const regionsByPage = useMemo(() => {
    const map = new Map<number, AnswerRegion[]>();
    for (const region of selected?.regions ?? []) {
      map.set(region.page, [...(map.get(region.page) ?? []), region]);
    }
    return map;
  }, [selected]);

  // Selecting a question scrolls the sheet to where that answer actually sits,
  // not just to the top of its page.
  useEffect(() => {
    const first = firstRegion;
    if (!first) return;
    const pageEl = pageRefs.current[first.page - 1];
    const container = scrollRef.current;
    if (!pageEl || !container) return;

    const pageTop = topWithinScroller(container, pageEl);
    const pageHeight = pageEl.getBoundingClientRect().height;
    const highlightTop = pageTop + first.box.y * pageHeight;
    const highlightHeight = first.box.h * pageHeight;
    const viewport = container.clientHeight;

    // Centre a short answer; pin a tall one near the top so its start is visible.
    const inset =
      highlightHeight < viewport * 0.7
        ? Math.max(24, (viewport - highlightHeight) / 2)
        : 72;

    container.scrollTo({
      top: Math.max(0, highlightTop - inset),
      behavior: "smooth",
    });
  }, [firstRegion, zoom]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const mid = container.clientHeight / 2;
    let page = 1;
    pageRefs.current.forEach((el, index) => {
      if (!el) return;
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      if (top <= mid) page = index + 1;
    });
    setCurrentPage(page);
  }, []);

  const goToPage = (page: number) => {
    const clamped = Math.min(answerPages.length, Math.max(1, page));
    const el = pageRefs.current[clamped - 1];
    const container = scrollRef.current;
    if (!el || !container) return;
    container.scrollTo({
      top: Math.max(0, topWithinScroller(container, el) - 16),
      behavior: "smooth",
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card bg-surface">
      {/* The title and the inspect toggle are desktop-only. Together with the
          two control pills they need ~470px, so on a phone the row wrapped and
          "Answer Sheet" broke across two lines — and the tab above the panel
          already says which of the two is open. */}
      <header
        className="flex h-14 shrink-0 items-center justify-between gap-2 px-3 md:h-16 md:gap-3 md:px-6"
        style={{
          backgroundColor: "var(--color-ink)",
          borderBottom: "1.25px solid rgb(0 0 0 / 0.1)",
        }}
      >
        <div className="hidden items-center gap-3 md:flex">
          <h2 className="t-p3-bold text-white">Answer Sheet</h2>
          {INSPECTABLE && (
            <button
              type="button"
              onClick={() => setInspecting((on) => !on)}
              aria-pressed={inspecting}
              className={`t-p5 rounded-pill px-3 py-1 transition-colors ${
                inspecting ? "bg-white text-ink" : "bg-[#464646] text-white"
              }`}
            >
              {blocks.length} blocks
            </button>
          )}
        </div>

        <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
          <div className="flex items-center gap-1 rounded-pill bg-[#464646] px-2 py-1 text-white">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              className="grid size-6 place-items-center rounded-full disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span className="t-p5 w-11 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() =>
                setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
              }
              className="grid size-6 place-items-center rounded-full disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-pill bg-[#464646] px-2 py-1 text-white">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              className="grid size-6 place-items-center rounded-full disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="t-p5 whitespace-nowrap tabular-nums">
              Page {currentPage} of {answerPages.length}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= answerPages.length}
              onClick={() => goToPage(currentPage + 1)}
              className="grid size-6 place-items-center rounded-full disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto bg-surface-2 p-2"
      >
        <div className="mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? "100%" : "none" }}>
          {answerPages.map((page, index) => (
            <div
              key={page.index}
              ref={(el) => {
                pageRefs.current[index] = el;
              }}
              className="relative mb-2 overflow-hidden rounded-lg bg-white shadow-sm last:mb-0"
            >
              {/* Sizing the image from the dimensions the rasteriser already
                  recorded reserves its height before the data URL decodes.
                  Without it the scroll-to-answer effect measures a zero-height
                  page and leaves the highlight off screen. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.dataUrl}
                alt={`Answer sheet page ${page.index + 1}`}
                width={page.width}
                height={page.height}
                className="block h-auto w-full"
              />

              {(rawByPage.get(page.index + 1) ?? []).map(({ block, region }) => (
                <div
                  key={`raw-${block.id}`}
                  className="pointer-events-none absolute"
                  style={{
                    left: `${region.box.x * 100}%`,
                    top: `${region.box.y * 100}%`,
                    width: `${region.box.w * 100}%`,
                    height: `${region.box.h * 100}%`,
                    border: "1px solid rgb(37 99 235 / 0.9)",
                    backgroundColor: "rgb(37 99 235 / 0.06)",
                  }}
                >
                  <span className="absolute -top-[14px] left-0 h-[14px] rounded-sm bg-blue-600 px-1 text-[10px] leading-[14px] whitespace-nowrap text-white">
                    {block.id} · {block.labelOnSheet ?? "no label"}
                  </span>
                </div>
              ))}

              {(regionsByPage.get(page.index + 1) ?? []).map((region, i) => (
                <div
                  key={`${region.page}-${i}`}
                  className="pointer-events-none absolute rounded-card transition-all duration-300"
                  style={{
                    left: `${region.box.x * 100}%`,
                    top: `${region.box.y * 100}%`,
                    width: `${region.box.w * 100}%`,
                    height: `${region.box.h * 100}%`,
                    border: `2px solid ${accent.line}`,
                    backgroundColor: accent.fill,
                  }}
                >
                  {region === firstRegion && (
                    <span
                      className={`absolute left-0 h-5 rounded-md px-1.5 text-[12px] leading-5 font-bold tracking-[-0.04em] text-white ${
                        // Sits on the box's own top-left corner, as the design
                        // draws it. A full tag-height above put the label in
                        // open paper — on a band that already reaches into the
                        // gap above the writing it read as pointing at nothing.
                        // The page clips its own overflow, so a box against the
                        // top of a page keeps the tag inside it instead.
                        region.box.y * 100 < 2 ? "top-0" : "-top-[10px]"
                      }`}
                      style={{ backgroundColor: accent.tag }}
                    >
                      {selected?.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
