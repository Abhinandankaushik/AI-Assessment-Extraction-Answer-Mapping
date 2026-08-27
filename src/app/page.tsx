"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { UploadScreen } from "@/components/upload/UploadScreen";
import { useAppStore } from "@/lib/store";

export default function UploadPage() {
  const setPhase = useAppStore((s) => s.setPhase);

  // Coming back from /review leaves the phase on "mapping"; the upload screen
  // is always the start of a run.
  useEffect(() => setPhase("upload"), [setPhase]);

  return (
    <AppShell>
      <UploadScreen />
    </AppShell>
  );
}
