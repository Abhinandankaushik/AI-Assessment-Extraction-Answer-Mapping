import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({
  children,
  collapsed = false,
  variant = "page",
}: {
  children: ReactNode;
  collapsed?: boolean;
  variant?: "page" | "mapping";
}) {
  return (
    <div
      className="relative min-h-dvh overflow-hidden p-3"
      style={{
        background:
          variant === "mapping" ? "var(--bg-mapping)" : "var(--bg-page)",
      }}
    >
      {variant === "page" && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-[86.3%] left-[15.8%] h-[54.4%] w-[91.5%] rounded-[50%] bg-[#171717]/40 blur-[110px]"
        />
      )}
      <div className="relative mx-auto flex h-[calc(100dvh-24px)] max-w-[1440px] gap-3">
        <div className="hidden md:flex">
          <Sidebar collapsed={collapsed} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <TopBar />
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
