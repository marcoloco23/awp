import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Identity card skeleton */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Bottom panels skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="card p-5 space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
