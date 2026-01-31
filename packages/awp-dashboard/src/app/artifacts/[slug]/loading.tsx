import { Skeleton } from "@/components/ui/Skeleton";

export default function ArtifactDetailLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      </div>

      {/* Metadata row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-12" />
        </div>
        <div className="card p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="card p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
      </div>

      {/* Body content */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Provenance */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-64" />
          </div>
        ))}
      </div>
    </div>
  );
}
