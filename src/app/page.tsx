"use client";

import { useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorScreen } from "@/components/loading/ErrorScreen";
import { ExtractingScreen } from "@/components/loading/ExtractingScreen";
import { UploadScreen } from "@/components/upload/UploadScreen";
import { runPipeline } from "@/lib/pipeline";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const phase = useAppStore((s) => s.phase);
  const files = useAppStore((s) => s.files);
  const setProgress = useAppStore((s) => s.setProgress);
  const fail = useAppStore((s) => s.fail);
  const loadRun = useAppStore((s) => s.loadRun);
  const started = useRef(false);

  useEffect(() => {
    if (phase !== "extracting" || started.current) return;
    if (!files.question || !files.answer) return;

    started.current = true;
    runPipeline(files.question, files.answer, setProgress)
      .then(loadRun)
      .catch((error: unknown) =>
        fail(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => {
        started.current = false;
      });
  }, [phase, files, setProgress, fail, loadRun]);

  return (
    <AppShell
      collapsed={phase !== "upload"}
      variant={phase === "mapping" ? "mapping" : "page"}
    >
      {phase === "upload" && <UploadScreen />}
      {phase === "extracting" && <ExtractingScreen />}
      {phase === "error" && <ErrorScreen />}
    </AppShell>
  );
}
