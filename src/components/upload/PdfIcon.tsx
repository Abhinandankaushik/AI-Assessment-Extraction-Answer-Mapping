/** 35 x 40 in the filled-state frame — a document shape, not a square tile. */
export function PdfIcon({
  width = 35,
  height = 40,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 35 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M0 5a5 5 0 0 1 5-5h16l14 14v21a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5Z"
        fill="#E8402A"
      />
      <path d="M21 0l14 14H24a3 3 0 0 1-3-3V0Z" fill="#fff" fillOpacity="0.3" />
      <text
        x="17.5"
        y="30"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="700"
        fill="#fff"
        fontFamily="var(--font-display)"
      >
        PDF
      </text>
    </svg>
  );
}
