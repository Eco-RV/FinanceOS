import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-40" />

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <div className="overflow-hidden rounded-lg border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
