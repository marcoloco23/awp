import { Skeleton } from "@/components/ui/Skeleton";

export default function MemoryLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton className="h-7 w-28" />

      {/* Long-term memory */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Daily logs */}
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <Skeleton className="h-5 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
