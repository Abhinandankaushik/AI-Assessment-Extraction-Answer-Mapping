export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
      <rect width="36" height="36" rx="10" fill="var(--color-dark)" />
      <path
        d="M10.5 11h4.3l3.2 9.1 3.2-9.1h4.3l-5.6 14.4h-3.8L10.5 11Z"
        fill="#fff"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="text-[22px] font-extrabold tracking-[-0.04em] text-dark">
      VedaAI
    </span>
  );
}
