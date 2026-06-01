import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideProps } from 'lucide-react';

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<Tone, { icon: string; activeBg: string; value: string }> = {
  brand: {
    icon: 'bg-brand-500/15 text-brand-500',
    activeBg: 'bg-brand-500/10 ring-brand-500/30',
    value: 'text-brand-600 dark:text-brand-400',
  },
  success: {
    icon: 'bg-emerald-500/15 text-emerald-500',
    activeBg: 'bg-emerald-500/10 ring-emerald-500/30',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    icon: 'bg-amber-500/15 text-amber-500',
    activeBg: 'bg-amber-500/10 ring-amber-500/30',
    value: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    icon: 'bg-red-500/15 text-red-500',
    activeBg: 'bg-red-500/10 ring-red-500/30',
    value: 'text-red-600 dark:text-red-400',
  },
  neutral: { icon: 'bg-surface-3 text-content-muted', activeBg: '', value: 'text-content' },
};

interface Props {
  icon: ComponentType<LucideProps>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  to?: string;
  active?: boolean;
  className?: string;
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  to,
  active = false,
  className = '',
}: Props) {
  const t = TONE[tone];
  const base = `card card-hover flex flex-col ${active ? t.activeBg : ''} ${className}`;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-content-muted">{label}</div>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </span>
      </div>
      <div className={`mt-3 text-4xl font-bold leading-none tracking-tight ${t.value}`}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-content-subtle">{hint}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={base}>
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
