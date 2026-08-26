"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Mirrors the "Primary Button - Dark" component: r64, 2px inner white border,
 *  and a disabled state expressed as 25% opacity rather than a colour swap. */
export function PrimaryButton({
  children,
  tone = "dark",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "dark" | "light";
}) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-btn border-2 pr-5 t-p4 transition-[opacity,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-25";
  const tones = {
    dark: "bg-ink border-white/15 text-white pl-6",
    light: "bg-white border-white/15 text-btn pl-4",
  } as const;

  return (
    <button className={`${base} ${tones[tone]} ${className}`} {...props}>
      {children}
    </button>
  );
}
