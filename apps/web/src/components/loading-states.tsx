import { Plus } from 'lucide-react'
import type { FileView } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { WorkspaceFrame } from '@/features/files/workspace-frame'
import { WorkspaceSidebarSkeleton } from '@/features/files/workspace-sidebar-skeleton'
import { FilesPageSkeleton } from '@/features/files/files-page-skeleton'
import type { WorkspaceSection } from '@/features/files/workspace-navigation'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { Logo } from './logo'

export function AppSkeleton({
  children,
  hideHeader = false,
  title = 'Canvases',
  section = 'files',
  view = 'mine',
}: {
  children?: React.ReactNode
  hideHeader?: boolean
  title?: string
  section?: WorkspaceSection
  view?: FileView
}) {
  return (
    <WorkspaceFrame
      sidebar={<WorkspaceSidebarSkeleton section={section} view={view} />}
      title={title}
      hideHeader={hideHeader}
      loading
      actions={
        section === 'files' && view === 'mine' ? (
          <Button size="sm" disabled>
            <Plus />
            New canvas
          </Button>
        ) : undefined
      }
    >
      {children ?? <FilesPageSkeleton title={title} view={view} />}
    </WorkspaceFrame>
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
