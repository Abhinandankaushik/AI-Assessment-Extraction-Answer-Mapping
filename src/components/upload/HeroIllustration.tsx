const DOTS = [
  { cx: 121.8, cy: 99.5, r: 4 },
  { cx: 84.8, cy: 127.9, r: 3 },
  { cx: 29.8, cy: 115.7, r: 4.5 },
  { cx: 11.7, cy: 48.1, r: 3.5 },
  { cx: 48.1, cy: 11.7, r: 3 },
  { cx: 115.7, cy: 29.8, r: 4 },
];

export function HeroIllustration({ size = 138 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 138 138" aria-hidden>
      <defs>
        <clipPath id="veda-hero-disc">
          <circle cx="69" cy="69" r="46" />
        </clipPath>
      </defs>

      <circle cx="69" cy="69" r="69" fill="#FF5623" fillOpacity="0.1" />
      <circle cx="69" cy="69" r="54" fill="#FF5623" fillOpacity="0.26" />

      <g clipPath="url(#veda-hero-disc)">
        <circle cx="69" cy="69" r="46" fill="#FDF1EC" />
        <path
          d="M69 78c-17 0-29 10-32 28v12h64v-12c-3-18-15-28-32-28Z"
          fill="#33302E"
        />
        <path
          d="M61 79.5 69 89l8-9.5"
          fill="none"
          stroke="#FDF1EC"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="63" y="60" width="12" height="16" rx="6" fill="#E5AC83" />
        <circle cx="69" cy="50" r="15" fill="#F3C49E" />
        <path
          d="M53.5 51c0-11 6.5-17.5 15.5-17.5S84.5 40 84.5 51c0-4.5-2-7-5.5-7.8-4.2-1-7 .8-10 .8s-5.8-1.8-10-.8c-3.5.8-5.5 3.3-5.5 7.8Z"
          fill="#2B2320"
        />
        <rect x="55" y="96" width="28" height="19" rx="2.5" fill="#fff" />
        <path d="M69 96v19" stroke="#E2E2E2" strokeWidth="1.6" />
      </g>

      <circle
        cx="69"
        cy="69"
        r="46"
        fill="none"
        stroke="#F6F6F6"
        strokeOpacity="0.97"
        strokeWidth="1.6"
      />
      {DOTS.map((d, i) => (
        <circle key={i} {...d} fill="#FF5623" />
      ))}
    </svg>
  );
}
