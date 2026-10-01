import { Skeleton } from '@rhyme/ui/components/skeleton'

export const fileGridClassName =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3'

export function FileGridSkeleton() {
  return (
    <div className={fileGridClassName} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="bg-card flex flex-col overflow-hidden rounded-lg border"
        >
          <Skeleton className="aspect-video rounded-none" />
          <div className="border-t px-3 py-2.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-0.5 h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
