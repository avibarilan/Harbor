import clsx from 'clsx';

function SkeletonBar({ className }) {
  return (
    <div
      className={clsx('rounded animate-[skeleton-pulse_1.5s_ease_infinite]', className)}
      style={{ background: 'var(--color-bg-hover)' }}
    />
  );
}

export default function SkeletonLoader({ variant = 'text', rows = 3, className }) {
  if (variant === 'card') {
    return (
      <div
        className={clsx('p-4 border', className)}
        style={{
          background: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <SkeletonBar className="h-4 w-3/4 mb-3" />
        <SkeletonBar className="h-3 w-1/2 mb-2" />
        <SkeletonBar className="h-3 w-2/3" />
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div
        className={clsx('flex items-center gap-4 px-4 py-3 border-b', className)}
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <SkeletonBar className="h-3 w-3 rounded-full shrink-0" />
        <SkeletonBar className="h-3 flex-1" />
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-3 w-16" />
      </div>
    );
  }

  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar key={i} className={clsx('h-3', i === rows - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  );
}
