export function PdfIcon({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden>
      <rect width="34" height="34" rx="8" fill="#E8402A" />
      <path d="M20.5 6H12a2 2 0 0 0-2 2v12h14V9.5L20.5 6Z" fill="#fff" fillOpacity=".22" />
      <text
        x="17"
        y="25"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#fff"
        fontFamily="var(--font-display)"
      >
        PDF
      </text>
    </svg>
  );
}
