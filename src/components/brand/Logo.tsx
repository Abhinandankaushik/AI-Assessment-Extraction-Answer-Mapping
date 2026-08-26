/** VedaAI mark: dark rounded square with the folded "V", whose left limb
 *  carries a white-to-grey gradient in the source file. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const gradientId = `veda-v-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient
          id={gradientId}
          x1="30"
          y1="24"
          x2="46"
          y2="80"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c7c7c7" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="23" fill="var(--color-dark)" />
      <path
        d="M17 22h30l7.5 34L69 22h14L59.5 77.5a5 5 0 0 1-4.6 3h-6.6a5 5 0 0 1-4.6-3L17 22Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
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
