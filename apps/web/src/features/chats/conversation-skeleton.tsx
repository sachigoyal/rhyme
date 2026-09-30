import { Skeleton } from '@rhyme/ui/components/skeleton'
import { ChatSkeleton } from '@/features/agent/chat-skeleton'

export function ConversationSkeleton() {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      role="status"
      aria-label="Loading conversation"
    >
      <div
        className="bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3"
        aria-hidden="true"
      >
        <Skeleton className="size-7 shrink-0" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="hidden h-3 w-36 sm:block" />
        <Skeleton className="ml-auto size-7 shrink-0" />
      </div>
      <ChatSkeleton />
    </section>
  )
}

export function ConversationListSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
      aria-hidden="true"
    >
      <div className="shrink-0 border-b p-5 lg:w-80 lg:border-r lg:border-b-0 xl:w-96">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-4 h-8 w-full" />
        <div className="mt-5 space-y-4">
          {[80, 65, 90, 55, 75].map((width) => (
            <div key={width} className="flex h-7 items-center">
              <Skeleton className="h-3" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 lg:flex">
        <Skeleton className="size-12 rounded-xl" />
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
    </div>
  )
}
