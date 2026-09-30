import { FilePlus2, Trash2, Users } from 'lucide-react'
import { useFiles } from '@rhyme/hooks/queries'
import type { FileView } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { FileCard } from './file-card'
import type { FolderNode } from './folder-tree'
import { useCreateAndOpenFile } from './use-create-file'

interface FileGridProps {
  view: FileView
  folderId?: string
  folders: FolderNode[]
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'

export function FileGrid({ view, folderId, folders }: FileGridProps) {
  const {
    data: files,
    isPending,
    isError,
    refetch,
  } = useFiles({ view, folderId })

  if (isPending) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[16/13] rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load your files"
        body="Check your connection and try again."
      >
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </EmptyState>
    )
  }

  if (files.length === 0) return <EmptyView view={view} folderId={folderId} />

  return (
    <div className={GRID}>
      {files.map((file) => (
        <FileCard key={file.id} file={file} folders={folders} />
      ))}
    </div>
  )
}

function EmptyView({ view, folderId }: { view: FileView; folderId?: string }) {
  const { create, isPending } = useCreateAndOpenFile()

  if (view === 'trash') {
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        body="Files you move to trash show up here."
      />
    )
  }
  if (view === 'shared') {
    return (
      <EmptyState
        icon={Users}
        title="Nothing shared yet"
        body="Files other people share with you appear here."
      />
    )
  }
  return (
    <EmptyState
      icon={FilePlus2}
      title="Start with a blank canvas"
      body="Sketch an idea, map a system or plan a flow."
    >
      <Button onClick={() => create(folderId)} disabled={isPending}>
        New file
      </Button>
    </EmptyState>
  )
}

interface EmptyStateProps {
  icon?: typeof Trash2
  title: string
  body: string
  children?: React.ReactNode
}

function EmptyState({ icon: Icon, title, body, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-24 text-center">
      {Icon && (
        <div className="bg-muted mb-4 grid size-11 place-items-center rounded-xl">
          <Icon className="text-muted-foreground size-5" />
        </div>
      )}
      <h2 className="font-medium">{title}</h2>
      <p className="text-muted-foreground mt-1 max-w-xs text-sm">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
