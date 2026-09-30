import { Skeleton } from '@rhyme/ui/components/skeleton'
import { Logo } from './logo'

export function AppSkeleton({
  children,
  hideHeader = false,
}: {
  children?: React.ReactNode
  hideHeader?: boolean
}) {
  return (
    <main
      className="bg-background flex h-svh"
      role="status"
      aria-label="Loading workspace"
    >
      <aside
        className="hidden w-64 shrink-0 space-y-4 border-r p-3 md:block"
        aria-hidden
      >
        <Logo />
        <Skeleton className="h-8" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-3/4" />
        ))}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!hideHeader && (
          <div
            className="flex h-12 shrink-0 items-center border-b px-3"
            aria-hidden="true"
          >
            <Skeleton className="h-4 w-36" />
          </div>
        )}
        {children ?? (
          <div
            className="space-y-4 px-4 py-4 sm:px-6 sm:py-5"
            aria-hidden="true"
          >
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-8 max-w-sm" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export function CanvasSkeleton({ title }: { title?: string }) {
  return (
    <main
      className="bg-background flex h-svh flex-col"
      role="status"
      aria-label="Loading canvas"
    >
      <div
        className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
        aria-hidden
      >
        <Logo />
        {title ? (
          <p className="truncate text-sm font-medium">{title}</p>
        ) : (
          <Skeleton className="h-4 w-32" />
        )}
        <Skeleton className="ml-auto h-7 w-20" />
        <Skeleton className="size-7 rounded-full" />
      </div>
      <div className="relative flex-1" aria-hidden>
        <Skeleton className="absolute left-3 top-3 h-8 w-28" />
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-lg border bg-card p-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="size-8" />
          ))}
        </div>
      </div>
    </main>
  )
}

export function AssistantSkeleton() {
  return (
    <div
      className="flex h-full flex-col gap-4 p-3"
      role="status"
      aria-label="Loading assistant"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-20" />
      <Skeleton className="mt-auto h-24" />
    </div>
  )
}
