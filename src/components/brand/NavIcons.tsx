interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Sidebar icons exported straight from the Figma file. They are monochrome
 * greyscale-with-alpha PNGs, so they are painted as a CSS mask rather than an
 * <img>: that way the glyph still inherits `currentColor` and picks up the
 * muted/active states the nav already uses.
 */
function MaskIcon({ src, size = 20, className }: IconProps & { src: string }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function HomeIcon(props: IconProps) {
  return <MaskIcon src="/icons/nav-home.png" {...props} />;
}

export function ClassroomIcon(props: IconProps) {
  return <MaskIcon src="/icons/nav-classroom.png" {...props} />;
}

export function AssignmentsIcon(props: IconProps) {
  return <MaskIcon src="/icons/nav-assignments.png" {...props} />;
}

export function ExamsIcon(props: IconProps) {
  return <MaskIcon src="/icons/nav-exams.png" {...props} />;
}

export function LibraryIcon(props: IconProps) {
  return <MaskIcon src="/icons/nav-library.png" {...props} />;
}
