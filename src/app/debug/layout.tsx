import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `/debug/*` holds development harnesses — one renders the sample sheet with a
 * hand-authored result set so the mapping UI can be exercised without spending
 * API quota. They are useful locally and misleading in public, so a deployed
 * build serves 404 for the whole subtree.
 */
export default function DebugLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
