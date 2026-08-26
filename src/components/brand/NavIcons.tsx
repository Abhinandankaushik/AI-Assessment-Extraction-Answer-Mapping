interface IconProps {
  size?: number;
  className?: string;
}

/** Sidebar icons traced from the Figma file rather than approximated with a
 *  stock set — the classroom and library glyphs in particular have no close
 *  equivalent in lucide. */
function Svg({
  size = 20,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7.6" height="7.6" rx="1.9" />
      <rect x="13.4" y="3" width="7.6" height="7.6" rx="1.9" />
      <rect x="3" y="13.4" width="7.6" height="7.6" rx="1.9" />
      <rect x="13.4" y="13.4" width="7.6" height="7.6" rx="1.9" />
    </Svg>
  );
}

export function ClassroomIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <rect
        x="2.5"
        y="4"
        width="19"
        height="16"
        rx="3.2"
        fill="currentColor"
      />
      <circle cx="15.2" cy="9.6" r="2.3" fill="#fff" />
      <path
        d="M2.5 12.4c3.4-.4 6 1.3 7.7 4.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M15.4 16.2l2.6 3.8h-3.4l.8-3.8Z" fill="#fff" />
    </svg>
  );
}

export function AssignmentsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.6 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8.4L13.6 3Z" />
      <path d="M13.4 3.2v3.4a1.8 1.8 0 0 0 1.8 1.8h3.4" />
      <path d="M9 12.4h.01" />
      <path d="M11.8 12.4h4.4" />
      <path d="M9 16.1h7.2" />
    </Svg>
  );
}

export function ExamsIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <rect
        x="4.6"
        y="4.8"
        width="14.8"
        height="16.2"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="8.4"
        y="2.4"
        width="7.2"
        height="4.8"
        rx="1.7"
        fill="currentColor"
      />
      <rect x="10.1" y="3.9" width="3.8" height="1.8" rx="0.9" fill="#fff" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11.4 4.1a8.4 8.4 0 1 0 8.4 8.4" />
      <path d="M13.6 2.6a8.4 8.4 0 0 1 8 8h-8v-8Z" />
    </Svg>
  );
}
