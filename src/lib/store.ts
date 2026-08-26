"use client";

import { create } from "zustand";
import type { Phase, UploadKind, UploadedFile } from "./types";

interface AppState {
  phase: Phase;
  files: Record<UploadKind, UploadedFile | null>;
  setFile: (file: UploadedFile) => void;
  removeFile: (kind: UploadKind) => void;
  setPhase: (phase: Phase) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  phase: "upload",
  files: { question: null, answer: null },
  setFile: (file) =>
    set((s) => ({ files: { ...s.files, [file.kind]: file } })),
  removeFile: (kind) => set((s) => ({ files: { ...s.files, [kind]: null } })),
  setPhase: (phase) => set({ phase }),
  reset: () =>
    set({ phase: "upload", files: { question: null, answer: null } }),
}));
