"use client";

import { create } from "zustand";
import type {
  AnswerBlock,
  ExtractedQuestion,
  GradingSummary,
  PageImage,
  Phase,
  QuestionResult,
  UploadKind,
  UploadedFile,
} from "./types";

export type Stage =
  | "idle"
  | "reading"
  | "questions"
  | "answers"
  | "mapping"
  | "done";

export interface Progress {
  stage: Stage;
  label: string;
  /** 0 to 1 across the whole run, so a single bar can represent every stage. */
  value: number;
}

export interface RunData {
  answerPages: PageImage[];
  questions: ExtractedQuestion[];
  blocks: AnswerBlock[];
  results: QuestionResult[];
  summary: GradingSummary;
  orphanBlockIds: string[];
}

interface AppState extends Omit<RunData, "summary"> {
  summary: GradingSummary | null;
  phase: Phase;
  files: Record<UploadKind, UploadedFile | null>;
  progress: Progress;
  error: string | null;
  selectedQuestionId: string | null;

  setFile: (file: UploadedFile) => void;
  removeFile: (kind: UploadKind) => void;
  setPhase: (phase: Phase) => void;
  setProgress: (progress: Progress) => void;
  fail: (message: string) => void;
  selectQuestion: (questionId: string | null) => void;
  loadRun: (run: RunData) => void;
  reset: () => void;
}

const EMPTY = {
  phase: "upload" as Phase,
  files: { question: null, answer: null },
  progress: { stage: "idle" as Stage, label: "", value: 0 },
  error: null,
  answerPages: [],
  questions: [],
  blocks: [],
  results: [],
  summary: null as GradingSummary | null,
  orphanBlockIds: [],
  selectedQuestionId: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...EMPTY,

  setFile: (file) => set((s) => ({ files: { ...s.files, [file.kind]: file } })),
  removeFile: (kind) => set((s) => ({ files: { ...s.files, [kind]: null } })),
  setPhase: (phase) => set({ phase }),
  setProgress: (progress) => set({ progress }),
  fail: (message) => set({ phase: "error", error: message }),
  selectQuestion: (selectedQuestionId) => set({ selectedQuestionId }),

  loadRun: (run) =>
    set({
      ...run,
      phase: "mapping",
      error: null,
      progress: { stage: "done", label: "Done", value: 1 },
      selectedQuestionId:
        run.results.find((r) => r.blockIds.length > 0)?.questionId ?? null,
    }),

  reset: () => set(EMPTY),
}));
