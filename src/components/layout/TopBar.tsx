"use client";

import {
  ArrowLeft,
  Bell,
  ChevronDown,
  CircleQuestionMark,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ExamsIcon } from "@/components/brand/NavIcons";

function Avatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#e4d7cf]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="12.5" r="5.2" fill="#3d2b23" />
        <path d="M4.5 32c1.3-6.6 6-10 11.5-10s10.2 3.4 11.5 10H4.5Z" fill="#3d2b23" />
      </svg>
    </span>
  );
}

export function TopBar({ title = "Exams" }: { title?: string }) {
  const router = useRouter();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2.5 rounded-card bg-white/75 py-2 pr-2 pl-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back to upload"
          className="text-ink transition-colors hover:text-brand"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="flex min-w-0 items-center gap-2 text-muted">
          <ExamsIcon size={16} className="shrink-0" />
          <span className="t-p4 truncate">{title}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Help"
          className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2"
        >
          <CircleQuestionMark size={20} />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-2 size-2 rounded-full bg-brand ring-2 ring-white" />
        </button>
        <button
          type="button"
          aria-label="AI actions"
          className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2"
        >
          <Sparkles size={18} />
        </button>
        <button
          type="button"
          className="ml-1 flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-surface-2"
        >
          <Avatar />
          <span className="t-p4 hidden text-dark sm:block">Abhinandan Kaushik</span>
          <ChevronDown size={16} className="text-ink" />
        </button>
      </div>
    </header>
  );
}
