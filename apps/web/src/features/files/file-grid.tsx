import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useTrashFile,
  useRestoreFile,
  useDestroyFile,
  useMoveFile,
} from '@rhyme/hooks/mutations'
import { toast } from '@rhyme/ui/components/toast'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  FilePlus2,
  FolderInput,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useFiles } from '@rhyme/hooks/queries'
import type { FileView } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { RefreshNotice } from '@/components/refresh-notice'
import { RecoveryState } from '@/components/recovery-state'
import { EmptyState } from '@/components/empty-state'
import { FileCard } from './file-card'
import { FileGridSkeleton, fileGridClassName } from './file-grid-skeleton'
import type { FolderNode } from './folder-tree'
import { useCreateAndOpenFile } from './use-create-file'

interface FileGridProps {
  view: FileView
  folderId?: string
  folders: FolderNode[]
  search?: string
  layout?: 'grid' | 'list'
  sort?: 'recent' | 'name'
}

export function FileGrid({
  view,
  folderId,
  folders,
  search = '',
  sort = 'recent',
  layout = 'grid',
}: FileGridProps) {
  const {
    data: files,
    isPending,
    isError,
    refetch,
  } = useFiles({ view, folderId })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const trash = useTrashFile()
  const restore = useRestoreFile()
  const destroy = useDestroyFile()
  const move = useMoveFile()

  if (isPending) return <FileGridSkeleton />

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

  const selectable = visible.filter(
    (file) => file.role === 'owner' && !file.id.startsWith('pending:'),
  )
  const selection = selectable.filter((file) => selected.has(file.id))
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const bulk = async (
    action: 'trash' | 'restore' | 'destroy' | 'move',
    destinationFolderId: string | null = null,
  ) => {
    if (busy || !selection.length) return
    setBusy(true)
    const failed = new Set<string>()
    let succeeded = 0
    try {
      for (const file of selection) {
        try {
          if (action === 'move')
            await move.mutateAsync({
              id: file.id,
              folderId: destinationFolderId,
            })
          else
            await { trash, restore, destroy }[action].mutateAsync({
              id: file.id,
            })
          succeeded++
        } catch {
          failed.add(file.id)
        }
      }
      setSelected(failed)
      if (succeeded)
        toast.success(
          `${succeeded} ${succeeded === 1 ? 'canvas' : 'canvases'} ${action === 'trash' ? 'moved to trash' : action === 'restore' ? 'restored' : action === 'destroy' ? 'deleted' : 'moved'}`,
        )
      if (failed.size)
        throw new Error(
          `Unable to update ${failed.size} ${failed.size === 1 ? 'canvas' : 'canvases'}. They remain selected; try again.`,
        )
    } finally {
      setBusy(false)
    }
  }
  const run = (
    action: 'trash' | 'restore' | 'move',
    destinationFolderId?: string | null,
  ) => {
    void bulk(action, destinationFolderId).catch((error: Error) =>
      toast.error(error.message),
    )
  }

  return (
    <>
      {notice}
      {selection.length > 0 &&
        createPortal(
          <div className="fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4 pointer-events-none">
            <div
              role="region"
              aria-label="Canvas selection actions"
              aria-busy={busy}
              className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border/70 bg-card/95 p-2 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 pl-2 pr-3 text-sm">
                <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                  {selection.length}
                </span>
                <span className="text-muted-foreground">selected</span>
                {busy && (
                  <Loader2
                    className="size-3.5 animate-spin text-muted-foreground"
                    aria-label="Updating canvases"
                  />
                )}
              </div>
              <span aria-hidden className="h-5 w-px bg-border" />
              {view === 'trash' ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => run('restore')}
                  >
                    <RotateCcw />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 />
                    Delete permanently
                  </Button>
                </>
              ) : (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          aria-label="Move selected canvases to folder"
                        >
                          <FolderInput />
                          Move to folder
                        </Button>
                      }
                    />
                    <DropdownMenuContent
                      side="top"
                      align="center"
                      sideOffset={12}
                      className="max-h-72 overflow-y-auto"
                    >
                      <DropdownMenuItem onClick={() => run('move', null)}>
                        No folder
                      </DropdownMenuItem>
                      {folders
                        .filter((folder) => !folder.id.startsWith('pending:'))
                        .map((folder) => (
                          <DropdownMenuItem
                            key={folder.id}
                            onClick={() => run('move', folder.id)}
                            style={{
                              paddingLeft: `${0.5 + folder.depth * 0.75}rem`,
                            }}
                          >
                            {folder.name}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy}
                    onClick={() => run('trash')}
                  >
                    <Trash2 />
                    Move to trash
                  </Button>
                </>
              )}
              <span aria-hidden className="h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear selection"
                disabled={busy}
                onClick={() => setSelected(new Set())}
              >
                <X />
              </Button>
            </div>
          </div>,
          document.body,
        )}
      <div
        className={`${selection.length ? 'pb-28 ' : ''}${layout === 'list' ? 'flex flex-col gap-2' : fileGridClassName}`}
      >
        {visible.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            folders={folders}
            layout={layout}
            selected={selected.has(file.id)}
            onSelect={() => toggle(file.id)}
            selectionDisabled={busy}
          />
        ))}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selection.length} ${selection.length === 1 ? 'canvas' : 'canvases'} permanently?`}
        description="The selected canvases and their assets will be permanently deleted. Agent activity is preserved. This cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={() => bulk('destroy')}
      />
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
