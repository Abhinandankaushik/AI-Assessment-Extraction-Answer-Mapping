"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { AnswerRegion } from "@/lib/types";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AnswerSheetViewer() {
  const { answerPages, blocks, results, questions, selectedQuestionId } =
    useAppStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [currentPage, setCurrentPage] = useState(1);

  const zoom = ZOOM_STEPS[zoomIndex];

  const selected = useMemo(() => {
    if (!selectedQuestionId) return null;
    const result = results.find((r) => r.questionId === selectedQuestionId);
    if (!result || result.blockIds.length === 0) return null;
    const question = questions.find((q) => q.id === selectedQuestionId);
    const regions = result.blockIds.flatMap(
      (id) => blocks.find((b) => b.id === id)?.regions ?? [],
    );
    return { label: question?.displayNumber ?? "", regions };
  }, [selectedQuestionId, results, questions, blocks]);

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
    const first = selected?.regions
      .slice()
      .sort((a, b) => a.page - b.page || a.box.y - b.box.y)[0];
    if (!first) return;
    const pageEl = pageRefs.current[first.page - 1];
    const container = scrollRef.current;
    if (!pageEl || !container) return;

    container.scrollTo({
      top: Math.max(0, pageEl.offsetTop + first.box.y * pageEl.offsetHeight - 72),
      behavior: "smooth",
    });
  }, [selected, zoom]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const mid = container.scrollTop + container.clientHeight / 2;
    let page = 1;
    pageRefs.current.forEach((el, index) => {
      if (el && el.offsetTop <= mid) page = index + 1;
    });
    setCurrentPage(page);
  }, []);

  const goToPage = (page: number) => {
    const clamped = Math.min(answerPages.length, Math.max(1, page));
    const el = pageRefs.current[clamped - 1];
    scrollRef.current?.scrollTo({ top: el?.offsetTop ?? 0, behavior: "smooth" });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card bg-surface">
      <header
        className="flex h-16 shrink-0 items-center justify-between gap-3 px-6"
        style={{
          backgroundColor: "var(--color-ink)",
          borderBottom: "1.25px solid rgb(0 0 0 / 0.1)",
        }}
      >
        <h2 className="t-p3-bold text-white">Answer Sheet</h2>

        <div className="flex items-center gap-2">
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
        className="min-h-0 flex-1 overflow-auto bg-surface-2 p-4"
      >
        <div className="mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? "100%" : "none" }}>
          {answerPages.map((page, index) => (
            <div
              key={page.index}
              ref={(el) => {
                pageRefs.current[index] = el;
              }}
              className="relative mb-4 overflow-hidden rounded-lg bg-white shadow-sm last:mb-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.dataUrl}
                alt={`Answer sheet page ${page.index + 1}`}
                className="block w-full"
              />

              {(regionsByPage.get(page.index + 1) ?? []).map((region, i) => (
                <div
                  key={`${region.page}-${i}`}
                  className="pointer-events-none absolute rounded-card transition-all duration-300"
                  style={{
                    left: `${region.box.x * 100}%`,
                    top: `${region.box.y * 100}%`,
                    width: `${region.box.w * 100}%`,
                    height: `${region.box.h * 100}%`,
                    border: "2px solid var(--color-hl-border)",
                    backgroundColor: "rgb(94 255 53 / 0.10)",
                  }}
                >
                  <span
                    className="t-p3-bold absolute -top-[30px] left-0 h-[30px] rounded-t-xl px-3 leading-[30px] text-white"
                    style={{ backgroundColor: "var(--color-success)" }}
                  >
                    {selected?.label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
