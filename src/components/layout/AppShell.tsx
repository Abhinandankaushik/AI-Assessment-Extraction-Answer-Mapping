import type { ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({
  children,
  variant = "page",
}: {
  children: ReactNode;
  variant?: "page" | "mapping";
}) {
  const desktopBackground =
    variant === "mapping" ? "var(--bg-mapping)" : "var(--bg-page)";

  return (
    <div
      className="relative h-dvh overflow-hidden bg-[var(--bg-mapping)] md:bg-[image:var(--desktop-bg)]"
      style={{ ["--desktop-bg" as string]: desktopBackground }}
    >
      {variant === "page" && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-[86.3%] left-[15.8%] hidden h-[54.4%] w-[91.5%] rounded-[50%] bg-[#171717]/40 blur-[110px] md:block"
        />
      )}

      {/* The Figma frame is 1440 wide, but the layout is fluid rather than
          capped there — a wider display should fill, not sit inside grey
          margins. The sidebar keeps its fixed 304px and the content flexes. */}
      <div className="relative flex h-full flex-col md:flex-row md:gap-3 md:p-3">
        <MobileHeader />
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:gap-3">
          <div className="hidden md:block">
            <TopBar />
          </div>
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
