interface Props {
  size?: 'sm' | 'md' | 'lg';
  withWordmark?: boolean;
  className?: string;
}

const SIZE_PX: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const WORDMARK_PX: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export function Logo({ size = 'sm', withWordmark = false, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/gradepulse-logo.jpg"
        alt="GradePulse"
        className={`${SIZE_PX[size]} rounded-lg object-cover shadow-sm ring-1 ring-slate-200`}
      />
      {withWordmark && (
        <span className={`font-semibold tracking-tight ${WORDMARK_PX[size]}`}>
          GradePulse
        </span>
      )}
    </span>
  );
}
