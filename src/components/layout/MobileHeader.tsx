"use client";

import { ArrowLeft, Bell, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";

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

/** Phone frames replace the desktop rail + top bar with a single floating bar
 *  sitting on a progressively blurred strip. */
export function MobileHeader() {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-20 bg-white/[0.01] px-2.5 pt-2.5 pb-3 backdrop-blur-xl md:hidden">
      <header className="flex h-14 items-center justify-between rounded-card bg-surface pr-4 pl-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Back to upload"
            className="grid size-7 place-items-center text-ink"
          >
            <ArrowLeft size={20} />
          </button>
          <LogoMark size={28} />
          <span className="text-[18px] font-extrabold tracking-[-0.04em] text-dark">
            VedaAI
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid size-7 place-items-center text-ink"
          >
            <Bell size={20} />
            <span className="absolute top-0 right-0 size-2 rounded-full bg-brand ring-2 ring-white" />
          </button>
          <Avatar size={28} />
          <button
            type="button"
            aria-label="Open menu"
            className="grid size-7 place-items-center text-ink"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
    </div>
  );
}
