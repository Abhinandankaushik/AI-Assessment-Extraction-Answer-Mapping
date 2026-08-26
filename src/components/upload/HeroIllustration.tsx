import Image from "next/image";

/** Exported from the Figma frame — concentric #FF5623 rings at 10% and 26%,
 *  the teacher artwork, and four orange feature badges.
 *  110px on phone frames, 138px on desktop. */
export function HeroIllustration() {
  return (
    <Image
      src="/illustrations/teacher.png"
      alt=""
      aria-hidden
      width={138}
      height={138}
      priority
      className="size-[110px] shrink-0 select-none md:size-[138px]"
    />
  );
}
