"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorScreen } from "@/components/loading/ErrorScreen";
import { ExtractingScreen } from "@/components/loading/ExtractingScreen";
import { MappingScreen } from "@/components/mapping/MappingScreen";
import { runPipeline } from "@/lib/pipeline";
import { runKeyFor, useAppStore } from "@/lib/store";

export default function ReviewPage() {
  const router = useRouter();
  const files = useAppStore((s) => s.files);
  const phase = useAppStore((s) => s.phase);
  const runKey = useAppStore((s) => s.runKey);
  const setPhase = useAppStore((s) => s.setPhase);
  const setProgress = useAppStore((s) => s.setProgress);
  const fail = useAppStore((s) => s.fail);
  const loadRun = useAppStore((s) => s.loadRun);
  const running = useRef(false);

  useEffect(() => {
    const key = runKeyFor(files);

    // Reached directly, or after a refresh cleared the in-memory upload.
    if (!key) {
      router.replace("/");
      return;
    }
    // Already have the result for exactly these files — don't pay for it twice.
    if (runKey === key || running.current) return;

    running.current = true;
    setPhase("extracting");
    runPipeline(files.question, files.answer, setProgress)
      .then((run) => loadRun(run, key))
      .catch((error: unknown) =>
        fail(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => {
        running.current = false;
      });
  }, [files, runKey, router, setPhase, setProgress, fail, loadRun]);

  return (
    <AppShell variant={phase === "mapping" ? "mapping" : "page"}>
      {phase === "mapping" ? (
        <MappingScreen />
      ) : phase === "error" ? (
        <ErrorScreen />
      ) : (
        <ExtractingScreen />
      )}
    </AppShell>
  );
}
