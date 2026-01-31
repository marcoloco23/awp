import { Skeleton } from "@/components/ui/Skeleton";

export default function ArtifactsLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton className="h-7 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-18 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
