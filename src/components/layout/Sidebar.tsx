"use client";

import { ChevronsRight, Settings, Sparkles } from "lucide-react";
import { LogoMark, PanelToggleIcon, Wordmark } from "@/components/brand/Logo";
import {
  AssignmentsIcon,
  ClassroomIcon,
  ExamsIcon,
  HomeIcon,
  LibraryIcon,
} from "@/components/brand/NavIcons";
import { useAppStore } from "@/lib/store";

const NAV = [
  { label: "Home", icon: HomeIcon },
  { label: "My Classroom", icon: ClassroomIcon },
  { label: "Assignments", icon: AssignmentsIcon },
  { label: "Exams", icon: ExamsIcon },
  { label: "My Library", icon: LibraryIcon },
] as const;

const ACTIVE = "Exams";

function SchoolCrest({ size = 40 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 2 4 5.5v6c0 4.6 3.2 8.9 8 10.5 4.8-1.6 8-5.9 8-10.5v-6L12 2Z"
          fill="none"
          stroke="#2f6b34"
          strokeWidth="1.4"
        />
        <path d="M12 7v9M9 10h6M9.5 13h5" stroke="#2f6b34" strokeWidth="1.4" />
      </svg>
    </span>
  );
}

/**
 * The rail the design switches to once a run starts. Which state it is in is
 * held in the store rather than derived from the phase, so the toggle still
 * works inside a phase: the run collapses it, returning to the upload screen
 * expands it, and pressing the button wins over both.
 */
export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  if (collapsed) {
    return (
      <aside className="flex w-16 shrink-0 flex-col items-center justify-between rounded-card bg-surface p-3 shadow-panel">
        <div className="flex flex-col items-center gap-4">
          <LogoMark size={32} />
          <button
            type="button"
            aria-label="AI Teacher's Toolkit"
            className="grid size-10 place-items-center rounded-full bg-dark text-white ring-2 ring-brand"
          >
            <Sparkles size={18} />
          </button>
          <nav className="flex flex-col items-center gap-1 pt-2">
            {NAV.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                aria-current={label === ACTIVE ? "page" : undefined}
                className={`grid size-9 place-items-center rounded-lg ${
                  label === ACTIVE ? "bg-surface-3 text-ink" : "text-muted"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </nav>
        </div>
        <div className="flex flex-col items-center gap-3">
          <SchoolCrest size={32} />
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            aria-expanded={false}
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[304px] shrink-0 flex-col justify-between rounded-card bg-surface p-6 shadow-panel">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={38} />
            <Wordmark />
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            aria-expanded
            className="text-muted transition-colors hover:text-ink"
          >
            <PanelToggleIcon size={20} />
          </button>
        </div>

        <button
          type="button"
          className="font-ui mt-14 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-dark text-[16px] font-medium tracking-[-0.04em] text-white transition-transform active:scale-[0.99]"
          // The border rides in the same shadow as the glow rather than coming
          // from ring-*: Tailwind builds rings out of box-shadow, and the
          // inline glow below replaces that whole property, so a ring class
          // here was silently painted over and never appeared at all.
          style={{
            boxShadow:
              "0 0 0 2px var(--color-brand), 0 6px 20px 0 rgb(255 86 35 / 0.28)",
          }}
        >
          <Sparkles size={16} />
          AI Teacher&rsquo;s Toolkit
        </button>

        <nav className="mt-14 flex flex-col gap-1.5">
          {NAV.map(({ label, icon: Icon }) => {
            const active = label === ACTIVE;
            return (
              <button
                key={label}
                type="button"
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-2 rounded-lg px-3 py-[9px] text-left t-p4 transition-colors ${
                  active
                    ? "bg-surface-3 text-ink"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-lg px-3 py-[9px] text-left t-p4 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Settings size={18} className="shrink-0" />
          Settings
        </button>
        <div className="flex items-center gap-4 rounded-card bg-surface-3 p-3">
          <SchoolCrest />
          <div className="min-w-0">
            <p className="t-p4 truncate font-bold text-dark">
              Delhi Public School
            </p>
            <p className="t-p5 truncate text-muted">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
