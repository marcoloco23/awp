import { Skeleton } from "@/components/ui/Skeleton";

export default function ReputationDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart placeholder */}
        <div className="card p-5 flex items-center justify-center">
          <Skeleton className="h-48 w-48 rounded-full" />
        </div>

        {/* Dimensions */}
        <div className="card p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal timeline */}
      <div className="card p-5">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
