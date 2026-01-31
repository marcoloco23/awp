import { Skeleton } from "@/components/ui/Skeleton";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Chart placeholder */}
      <div className="card p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="card p-3 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="card p-3 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
