import { Skeleton } from "@/components/ui/Skeleton";

export default function ReputationLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton className="h-7 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card p-5 flex items-center gap-5">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
