/** The four-point sparkle from the Figma loading frame, with its two accents. */
export function Sparkle({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <path
        d="M78 18c0 18 12 30 30 30-18 0-30 12-30 30 0-18-12-30-30-30 18 0 30-12 30-30Z"
        fill="var(--color-brand)"
      />
      <path
        d="M40 74c0 11 7 18 18 18-11 0-18 7-18 18 0-11-7-18-18-18 11 0 18-7 18-18Z"
        fill="var(--color-brand)"
      />
      <circle cx="26" cy="46" r="5" fill="var(--color-brand)" />
      <circle cx="88" cy="98" r="3.5" fill="var(--color-brand)" opacity="0.75" />
    </svg>
  );
}
