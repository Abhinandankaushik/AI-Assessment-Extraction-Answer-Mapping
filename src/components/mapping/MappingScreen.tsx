"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { AnswerSheetViewer } from "./AnswerSheetViewer";
import { QuestionList } from "./QuestionList";

type Tab = "questions" | "answers";

/** Phone frames swap the two panels behind a segmented control; desktop shows
 *  the 640px question column beside the sheet. */
export function MappingScreen() {
  const [tab, setTab] = useState<Tab>("questions");
  const selectedQuestionId = useAppStore((s) => s.selectedQuestionId);
  const previousSelection = useRef(selectedQuestionId);

  // Tapping a question on a phone should reveal the highlight it just moved to.
  // The initial selection made by loadRun is skipped so the run opens on the list.
  useEffect(() => {
    if (selectedQuestionId && previousSelection.current !== selectedQuestionId) {
      setTab("answers");
    }
    previousSelection.current = selectedQuestionId;
  }, [selectedQuestionId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex rounded-pill bg-surface-2 p-1 md:hidden">
        {(
          [
            ["questions", "Questions"],
            ["answers", "Answer Sheet"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`t-p4 flex-1 rounded-pill py-2.5 transition-colors ${
              tab === key ? "bg-ink text-white" : "text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div
          className={`min-h-0 w-full md:block md:w-[640px] md:shrink-0 ${
            tab === "questions" ? "block" : "hidden"
          }`}
        >
          <QuestionList />
        </div>
        <div
          className={`min-h-0 w-full flex-1 md:block ${
            tab === "answers" ? "block" : "hidden"
          }`}
        >
          <AnswerSheetViewer />
        </div>
      </div>
    </div>
  );
}
