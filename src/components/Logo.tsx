interface Props {
  size?: 'sm' | 'md' | 'lg';
  withWordmark?: boolean;
  /** Show the full logo image (icon + wordmark baked in) — used on auth pages */
  full?: boolean;
  className?: string;
}

const ICON_PX: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
};

const WORDMARK_PX: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

const FULL_PX: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-20',
};

export function Logo({ size = 'sm', withWordmark = false, full = false, className = '' }: Props) {
  if (full) {
    // Whole branded logo (icon + "GradePulse" baked into the image).
    return (
      <img
        src="/gradepulse-logo.jpg"
        alt="GradePulse"
        className={`${FULL_PX[size]} w-auto rounded-xl object-contain ${className}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Icon tile — ring + tint so the dark-navy logo stays visible on a dark sidebar */}
      <img
        src="/gradepulse-logo.jpg"
        alt="GradePulse"
        className={`${ICON_PX[size]} shrink-0 rounded-xl object-cover object-top shadow-sm ring-1 ring-white/15`}
      />
      {withWordmark && (
        <span className={`font-bold tracking-tight ${WORDMARK_PX[size]}`}>
          <span className="text-content">Grade</span>
          <span className="text-brand-500">Pulse</span>
        </span>
      )}
    </span>
  );
}
