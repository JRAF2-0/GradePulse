interface SkeletonProps {
  className?: string;
  /** When true, render as inline-block so it sits next to text. */
  inline?: boolean;
}

/**
 * Pulsing grey block used as a content placeholder while data loads.
 * Use Tailwind utilities via className to size it (e.g. `h-4 w-32`, `h-8 w-full`).
 */
export function Skeleton({ className = 'h-4 w-full', inline = false }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`${inline ? 'inline-block' : 'block'} animate-pulse rounded-md bg-surface-3 ${className}`}
    />
  );
}

interface SkeletonLinesProps {
  lines?: number;
  className?: string;
}

export function SkeletonLines({ lines = 3, className = '' }: SkeletonLinesProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-4/5'}`}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton used as a page-level loading placeholder. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card space-y-4 ${className}`}>
      <Skeleton className="h-5 w-1/3" />
      <SkeletonLines lines={3} />
    </div>
  );
}

/** A skeleton row for tables (renders inside a <tbody>). */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}

/** Block of N skeleton rows (renders inside a <tbody>). */
export function SkeletonTableRows({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </>
  );
}

/** Full-page initial loading skeleton — used in RoleGuard / Suspense fallback. */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-7 w-1/3" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard className="!space-y-3" />
    </div>
  );
}
