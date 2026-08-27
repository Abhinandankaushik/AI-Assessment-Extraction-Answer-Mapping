"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

/** Extraction used to fail silently and render an empty result, which reads as
 *  "the student answered nothing". Failures are now explicit. */
export function ErrorScreen() {
  const router = useRouter();
  const { error, reset } = useAppStore();
  const quotaHit = /quota|exhausted|429/i.test(error ?? "");

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-card bg-surface px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-danger-tint text-danger">
        <TriangleAlert size={26} />
      </span>

      <h2 className="mt-5 text-[24px] leading-[1.2] font-bold tracking-[-0.04em] text-dark">
        {quotaHit ? "Daily AI quota reached" : "Something went wrong"}
      </h2>

      <p className="t-p3 mt-2 max-w-[460px] text-muted">
        {quotaHit
          ? "Every configured Gemini model has used its free-tier allowance for today. Try again tomorrow, or add a key with more headroom."
          : (error ?? "The extraction could not be completed.")}
      </p>

      <PrimaryButton
        className="mt-7"
        onClick={() => {
          reset();
          router.push("/");
        }}
      >
        <RotateCcw size={16} />
        Start over
      </PrimaryButton>
    </div>
  );
}
