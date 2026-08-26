import type { ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
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

      {/* Phone: a single floating bar. Desktop: 1440 frame with a 12px inset,
          which yields the 1100px content column the Figma frames use. */}
      <div className="relative flex h-full flex-col md:mx-auto md:max-w-[1440px] md:flex-row md:gap-3 md:p-3">
        <MobileHeader />
        <div className="hidden md:flex">
          <Sidebar collapsed={collapsed} />
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
