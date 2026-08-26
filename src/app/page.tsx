"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/lib/store";
import { UploadScreen } from "@/components/upload/UploadScreen";

export default function Home() {
  const phase = useAppStore((s) => s.phase);

  return (
    <AppShell collapsed={phase !== "upload"}>
      {phase === "upload" && <UploadScreen />}
    </AppShell>
  );
}
