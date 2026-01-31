import { Skeleton } from "@/components/ui/Skeleton";

export default function ContractsLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton className="h-7 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
