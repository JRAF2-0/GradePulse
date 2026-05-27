import type { RiskLevel } from '@/types/database';

const STYLES: Record<RiskLevel, { label: string; cls: string; icon: string }> = {
  low: {
    label: 'Low risk',
    cls: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
    icon: '✓',
  },
  medium: {
    label: 'Medium risk',
    cls: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
    icon: '!',
  },
  high: {
    label: 'High risk',
    cls: 'bg-red-100 text-red-800 ring-1 ring-red-300',
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
  const sizeCls = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${s.cls} ${sizeCls}`}
      title={`Risk level: ${level}`}
    >
      <span aria-hidden>{s.icon}</span> {s.label}
    </span>
  );
}
