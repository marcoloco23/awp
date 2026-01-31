interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton-pulse rounded-md bg-[var(--surface-2)] ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-4 space-y-3 ${className}`}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}
