import { FilePlus2, Search, Trash2, Users } from 'lucide-react'
import { useFiles } from '@rhyme/hooks/queries'
import type { FileView } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { RefreshNotice } from '@/components/refresh-notice'
import { RecoveryState } from '@/components/recovery-state'
import { EmptyState } from '@/components/empty-state'
import { FileCard } from './file-card'
import type { FolderNode } from './folder-tree'
import { useCreateAndOpenFile } from './use-create-file'

interface FileGridProps {
  view: FileView
  folderId?: string
  folders: FolderNode[]
  search?: string
  sort?: 'recent' | 'name'
}

const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3'

export function FileGrid({
  view,
  folderId,
  folders,
  search = '',
  sort = 'recent',
}: FileGridProps) {
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
          <Skeleton key={index} className="aspect-[16/13] rounded-lg" />
        ))}
      </div>
    )
  }

  if (!files)
    return (
      <RecoveryState
        title="Unable to load canvases"
        description="Check your connection and try again."
        onRetry={async () => {
          const result = await refetch()
          if (result.error) throw result.error
        }}
      />
    )

  const notice = isError && <RefreshNotice onRetry={refetch} />
  if (files.length === 0)
    return (
      <>
        {notice}
        <EmptyView view={view} folderId={folderId} />
      </>
    )

  const visible = files
    .filter((file) =>
      file.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .toSorted((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : b.updatedAt.getTime() - a.updatedAt.getTime(),
    )
  if (!visible.length)
    return (
      <>
        {notice}
        <EmptyState
          icon={Search}
          title="No matching canvases"
          body="Try a different name or clear your search."
        />
      </>
    )

  return (
    <>
      {notice}
      <div className={GRID}>
        {visible.map((file) => (
          <FileCard key={file.id} file={file} folders={folders} />
        ))}
      </div>
    </>
  )
}

function EmptyView({ view, folderId }: { view: FileView; folderId?: string }) {
  const { create, isPending } = useCreateAndOpenFile()

  if (view === 'trash') {
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        body="Deleted canvases appear here until permanently removed."
      />
    )
  }
  if (view === 'shared') {
    return (
      <EmptyState
        icon={Users}
        title="No shared canvases"
        body="Canvases shared with your account appear here."
      />
    )
  }
  return (
    <EmptyState
      icon={FilePlus2}
      title="No canvases"
      body="Create a canvas to start drawing."
    >
      <Button onClick={() => create(folderId)} disabled={isPending}>
        New canvas
      </Button>
    </EmptyState>
  )
}
