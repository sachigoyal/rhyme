import { Skeleton } from '@rhyme/ui/components/skeleton'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { SidebarTrigger } from '@rhyme/ui/components/sidebar'
import { Separator } from '@rhyme/ui/components/separator'
import { WorkspaceBreadcrumbs } from '@/components/workspace-breadcrumbs'

export function ConversationHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <header className="bg-card flex h-16 shrink-0 items-center gap-3 border-b px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="data-[orientation=vertical]:h-4"
      />
      <h1 className="sr-only">{title}</h1>
      <WorkspaceBreadcrumbs
        items={[
          {
            label: 'Conversations',
            link: <Link to="/chats">Conversations</Link>,
          },
          { label: title },
        ]}
      />
      {children}
    </header>
  )
}

export function ConversationSkeleton() {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      role="status"
      aria-label="Loading conversation"
    >
      <ConversationHeader title="Loading conversation…" />
      <div
        className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6 sm:p-8"
        aria-hidden
      >
        <Skeleton className="ml-auto h-12 w-2/3" />
        <Skeleton className="h-28 w-5/6" />
        <Skeleton className="ml-auto h-12 w-1/2" />
      </div>
      <div className="mx-auto w-full max-w-3xl p-5" aria-hidden>
        <Skeleton className="h-24" />
      </div>
    </section>
  )
}
