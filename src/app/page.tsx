"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { UploadScreen } from "@/components/upload/UploadScreen";
import { useAppStore } from "@/lib/store";

export default function UploadPage() {
  const setPhase = useAppStore((s) => s.setPhase);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  // Coming back from /review leaves the phase on "mapping"; the upload screen
  // is always the start of a run, and the design gives it the full sidebar.
  useEffect(() => {
    setPhase("upload");
    setSidebarCollapsed(false);
  }, [setPhase, setSidebarCollapsed]);

  return (
    <AppShell>
      <UploadScreen />
    </AppShell>
  );
}
