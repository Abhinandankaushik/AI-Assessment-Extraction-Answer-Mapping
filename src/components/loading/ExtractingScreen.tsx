"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { Sparkle } from "./Sparkle";

const STAGES = [
  { key: "reading", label: "Reading files" },
  { key: "questions", label: "Questions" },
  { key: "answers", label: "Answers" },
  { key: "mapping", label: "Mapping" },
] as const;

export function ExtractingScreen() {
  const { progress } = useAppStore();
  const activeIndex = STAGES.findIndex((s) => s.key === progress.stage);

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-card bg-surface px-6 py-10">
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkle />
      </motion.div>

      <h2 className="mt-6 text-[24px] leading-[1.2] font-bold tracking-[-0.04em] text-dark">
        Extracting&hellip;
      </h2>
      <p className="t-p3 mt-1 text-muted">This may take a while</p>

      {/* The brief asks for visible processing progress, so the real stage and
          a single bar are surfaced rather than an indeterminate spinner. */}
      <div className="mt-8 w-full max-w-[420px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${Math.round(progress.value * 100)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        <p className="t-p5 mt-3 text-center text-ink">
          {progress.label || "Starting…"}
        </p>

        {/* A phone used to get the dots on their own: four labels would not sit
            beside four dots in 320px, so they were hidden and the row said
            nothing about which stage it was. Stacking the label under its dot
            fits at any width, so the stage is named on every screen. */}
        <ol className="mt-5 flex items-start justify-between gap-1">
          {STAGES.map((stage, index) => {
            const done = activeIndex > index || progress.stage === "done";
            const active = activeIndex === index;
            return (
              <li
                key={stage.key}
                className={`flex flex-1 flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2 sm:text-left ${
                  done || active ? "text-dark" : "text-muted/60"
                }`}
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    done
                      ? "bg-success"
                      : active
                        ? "animate-pulse bg-brand"
                        : "bg-surface-3"
                  }`}
                />
                {/* Spelled out rather than reusing .t-p5: that is a plain class
                    in globals.css, not a registered utility, so "sm:t-p5" would
                    never be generated and the label would stay 11px. */}
                <span className="text-[11px] leading-[1.3] tracking-[-0.04em] sm:text-[14px] sm:leading-[1.4]">
                  {stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
