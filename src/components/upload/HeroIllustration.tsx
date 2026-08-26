import Image from "next/image";

/** Exported from the Figma frame (138 x 138) — concentric #FF5623 rings at
 *  10% and 26%, the teacher artwork, and four orange feature badges. */
export function HeroIllustration({ size = 138 }: { size?: number }) {
  return (
    <Image
      src="/illustrations/teacher.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}
