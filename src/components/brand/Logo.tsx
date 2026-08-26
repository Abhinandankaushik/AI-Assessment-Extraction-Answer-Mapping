import Image from "next/image";

/** The VedaAI mark, exported from the Figma file. Unlike the nav glyphs this
 *  one is two-tone (dark tile, white "V"), so it is a real image rather than a
 *  currentColor mask. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/icons/vedaai-mark.png"
      alt=""
      aria-hidden
      width={40}
      height={40}
      priority
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-extrabold tracking-[-0.04em] text-dark"
      style={{ fontSize: size }}
    >
      VedaAI
    </span>
  );
}

/** The panel-collapse control from the sidebar header. */
export function PanelToggleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <path d="M9.4 4.5v15" />
    </svg>
  );
}
