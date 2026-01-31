import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function ExperimentDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-72" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <SkeletonCard className="h-32" />
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-80" />
    </div>
  );
}
