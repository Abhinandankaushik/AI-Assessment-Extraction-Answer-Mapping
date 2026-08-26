import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <h1 className="t-h1">
            <span className="text-dark">Upload </span>
            <span className="rounded-lg bg-brand/15 px-2 text-brand">
              Question Paper &amp; Answer Sheets
            </span>
          </h1>
          <p className="t-p1 mt-2 text-ink">Upload both files to get started</p>
        </div>
      </div>
    </AppShell>
  );
}
