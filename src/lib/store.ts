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
  /** A slot holds either one PDF or several page images, in page order. */
  files: Record<UploadKind, UploadedFile[]>;
  progress: Progress;
  error: string | null;
  selectedQuestionId: string | null;
  /** An unmatched answer the teacher clicked, highlighted on the sheet the
   *  same way a question's answer is. */
  selectedBlockId: string | null;
  sidebarCollapsed: boolean;
  /** Identifies the upload a completed run belongs to, so returning to
   *  /review with the same files shows the result instead of paying for it
   *  again. */
  runKey: string | null;

  addFiles: (kind: UploadKind, files: UploadedFile[]) => void;
  removeFile: (kind: UploadKind, id: string) => void;
  clearSlot: (kind: UploadKind) => void;
  setPhase: (phase: Phase) => void;
  setProgress: (progress: Progress) => void;
  fail: (message: string) => void;
  selectQuestion: (questionId: string | null) => void;
  selectBlock: (blockId: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  loadRun: (run: RunData, runKey?: string | null) => void;
  reset: () => void;
}

const EMPTY = {
  phase: "upload" as Phase,
  files: { question: [] as UploadedFile[], answer: [] as UploadedFile[] },
  progress: { stage: "idle" as Stage, label: "", value: 0 },
  error: null,
  answerPages: [],
  questions: [],
  blocks: [],
  results: [],
  summary: null as GradingSummary | null,
  orphanBlockIds: [],
  selectedQuestionId: null,
  selectedBlockId: null,
  sidebarCollapsed: false,
  runKey: null,
};

/** Two uploads are "the same run" when the same files sit in both slots. */
export function runKeyFor(files: Record<UploadKind, UploadedFile[]>): string | null {
  if (files.question.length === 0 || files.answer.length === 0) return null;
  const ids = (list: UploadedFile[]) => list.map((f) => f.id).join("|");
  return `${ids(files.question)}::${ids(files.answer)}`;
}

export const useAppStore = create<AppState>((set) => ({
  ...EMPTY,

  // A PDF stands alone; images accumulate and are kept in page order. Mixing
  // the two in one slot is meaningless, so the newer kind replaces the older.
  addFiles: (kind, incoming) =>
    set((s) => {
      const hasPdf = incoming.some((f) => f.isPdf);
      const existing = hasPdf || s.files[kind].some((f) => f.isPdf)
        ? []
        : s.files[kind];
      const merged = [...existing, ...incoming].filter(
        (file, index, all) => all.findIndex((f) => f.id === file.id) === index,
      );
      return { files: { ...s.files, [kind]: hasPdf ? incoming.slice(0, 1) : merged } };
    }),

  removeFile: (kind, id) =>
    set((s) => ({
      files: { ...s.files, [kind]: s.files[kind].filter((f) => f.id !== id) },
    })),

  clearSlot: (kind) => set((s) => ({ files: { ...s.files, [kind]: [] } })),
  setPhase: (phase) => set({ phase }),
  setProgress: (progress) => set({ progress }),
  fail: (message) => set({ phase: "error", error: message }),
  // Only one thing is highlighted at a time, so each selection clears the other.
  selectQuestion: (selectedQuestionId) =>
    set({ selectedQuestionId, selectedBlockId: null }),
  selectBlock: (selectedBlockId) =>
    set({ selectedBlockId, selectedQuestionId: null }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  loadRun: (run, runKey = null) =>
    set({
      ...run,
      runKey,
      phase: "mapping",
      error: null,
      progress: { stage: "done", label: "Done", value: 1 },
      selectedQuestionId:
        run.results.find((r) => r.blockIds.length > 0)?.questionId ?? null,
      selectedBlockId: null,
    }),

  reset: () => set(EMPTY),
}));
