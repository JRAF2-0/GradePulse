import type { RiskLevel } from '@/types/database';

const STYLES: Record<RiskLevel, { label: string; cls: string; icon: string }> = {
  low: {
    label: 'Low risk',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30',
    icon: '✓',
  },
  medium: {
    label: 'Medium risk',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30',
    icon: '!',
  },
  high: {
    label: 'High risk',
    cls: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30',
    icon: '⚠',
  },
};

export function RiskBadge({
  level,
  size = 'md',
}: {
  level: RiskLevel | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!level) return null;
  const s = STYLES[level];
  const sizeCls = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${s.cls} ${sizeCls}`}
      title={`Risk level: ${level}`}
    >
      <span aria-hidden>{s.icon}</span> {s.label}
    </span>
  );
}
