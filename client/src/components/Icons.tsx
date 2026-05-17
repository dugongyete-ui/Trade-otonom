interface IconProps {
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

const base = (size: number, style?: React.CSSProperties, className?: string, children: React.ReactNode = null) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    className={className}
  >
    {children}
  </svg>
);

export function IconActivity({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>
  );
}

export function IconWifi({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </>
  );
}

export function IconWifiOff({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </>
  );
}

export function IconLoader({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </>
  );
}

export function IconTrendUp({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  );
}

export function IconTrendDown({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </>
  );
}

export function IconMinus({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <line x1="5" y1="12" x2="19" y2="12" />
  );
}

export function IconDollar({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  );
}

export function IconBarChart({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  );
}

export function IconTarget({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  );
}

export function IconAlert({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  );
}

export function IconBrain({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.14Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.14Z" />
    </>
  );
}

export function IconLightbulb({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </>
  );
}

export function IconInfo({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  );
}

export function IconCopy({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  );
}

export function IconCheck({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  );
}

export function IconChevronDown({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <polyline points="6 9 12 15 18 9" />
  );
}

export function IconChevronRight({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <polyline points="9 18 15 12 9 6" />
  );
}

export function IconChevronLeft({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <polyline points="15 18 9 12 15 6" />
  );
}

export function IconSignal({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <line x1="2" y1="20" x2="2" y2="14" />
      <line x1="8" y1="20" x2="8" y2="10" />
      <line x1="14" y1="20" x2="14" y2="5" />
      <line x1="20" y1="20" x2="20" y2="2" />
    </>
  );
}

export function IconDatabase({ size = 16, style, className }: IconProps) {
  return base(size, style, className,
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  );
}
