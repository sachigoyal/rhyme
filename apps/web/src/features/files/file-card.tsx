import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  FolderInput,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from '@rhyme/ui/components/toast'
import {
  useDestroyFile,
  useMoveFile,
  useRenameFile,
  useRestoreFile,
  useTrashFile,
} from '@rhyme/hooks/mutations'
import type { FileSummary } from '@rhyme/trpc-client'
import { Badge } from '@rhyme/ui/components/badge'
import { Button } from '@rhyme/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { NameDialog } from '@/components/name-dialog'
import { displayName } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { thumbnailUrl } from '@/lib/storage'
import type { FolderNode } from './folder-tree'

interface FileCardProps {
  file: FileSummary
  folders: FolderNode[]
  layout?: 'grid' | 'list'
  selected?: boolean
  onSelect?: () => void
  selectionDisabled?: boolean
}

export function FileCard({
  file,
  folders,
  layout = 'grid',
  selected = false,
  onSelect,
  selectionDisabled,
}: FileCardProps) {
  const pending = file.id.startsWith('pending:')
  const trashed = file.trashedAt !== null
  const preview = <FilePreview file={file} compact={layout === 'list'} />

  return (
    <div
      className={`group bg-card hover:border-primary/40 focus-within:border-primary relative flex overflow-hidden rounded-lg border transition-colors ${layout === 'list' ? 'flex-row items-center gap-3 p-3' : 'flex-col'} ${selected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}
    >
      {onSelect && file.role === 'owner' && !pending && (
        <input
          type="checkbox"
          aria-label={`Select ${file.name}`}
          checked={selected}
          onChange={onSelect}
          disabled={selectionDisabled}
          className={`z-10 size-4 shrink-0 cursor-pointer accent-primary ${layout === 'grid' ? 'absolute left-3 top-3' : 'relative'}`}
        />
      )}
      {trashed || pending ? (
        preview
      ) : (
        <Link
          to="/files/$fileId"
          params={{ fileId: file.id }}
          aria-label={`Open ${file.name}`}
          className={`shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${layout === 'list' ? 'w-20 rounded-md overflow-hidden' : ''}`}
        >
          {preview}
          <span className="absolute inset-0" aria-hidden />
        </Link>
      )}
      <div
        className={`flex min-w-0 flex-1 items-center gap-2 ${layout === 'grid' ? 'border-t px-3 py-2.5' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {pending
              ? 'Creating canvas…'
              : file.role === 'owner'
                ? `Edited ${timeAgo(file.updatedAt)}`
                : `${displayName(file.owner)} · ${timeAgo(file.updatedAt)}`}
          </p>
        </div>
        {file.role !== 'owner' && (
          <Badge variant="secondary" className="capitalize">
            {file.role}
          </Badge>
        )}
        {file.role === 'owner' && !pending && (
          <FileMenu file={file} folders={folders} />
        )}
      </div>
    </div>
  )
}

function FilePreview({
  file,
  compact,
}: {
  file: FileSummary
  compact: boolean
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className={`bg-background relative aspect-video overflow-hidden ${compact ? 'w-20 shrink-0 rounded-md' : ''}`}
    >
      {file.hasThumbnail && !failed ? (
        <img
          src={thumbnailUrl(file.id, file.version)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain p-3 dark:invert dark:hue-rotate-180"
        />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground/30">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden
          >
            <rect
              x="5"
              y="5"
              width="26"
              height="26"
              rx="4"
              stroke="currentColor"
            />
            <path
              d="M12 23l5-8 4 5 3-3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

function FileMenu({ file, folders }: FileCardProps) {
  const [dialog, setDialog] = useState<'rename' | 'destroy' | null>(null)
  const renameFile = useRenameFile()
  const moveFile = useMoveFile()
  const trashFile = useTrashFile()
  const restoreFile = useRestoreFile()
  const destroyFile = useDestroyFile()
  const close = (open: boolean) => !open && setDialog(null)
  const trashed = file.trashedAt !== null

  async function restore() {
    try {
      await restoreFile.mutateAsync({ id: file.id })
      toast.success(`Restored “${file.name}”`)
    } catch {
      toast.error('Unable to restore canvas')
    }
  }

  async function trash() {
    try {
      await trashFile.mutateAsync({ id: file.id })
      toast(`Moved “${file.name}” to trash`, {
        action: { label: 'Undo', onClick: () => void restore() },
      })
    } catch {
      toast.error('Unable to move canvas to trash')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10 -mr-1.5 shrink-0"
              aria-label={`Options for ${file.name}`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          {trashed ? (
            <>
              <DropdownMenuItem onClick={() => void restore()}>
                <RotateCcw />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDialog('destroy')}
              >
                <X />
                Delete permanently
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setDialog('rename')}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput />
                  Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                  <DropdownMenuRadioGroup
                    value={file.folderId ?? ''}
                    onValueChange={(folderId) =>
                      moveFile.mutate({
                        id: file.id,
                        folderId: folderId || null,
                      })
                    }
                  >
                    <DropdownMenuRadioItem value="">
                      No folder
                    </DropdownMenuRadioItem>
                    {folders.map((folder) => (
                      <DropdownMenuRadioItem
                        key={folder.id}
                        disabled={folder.id.startsWith('pending:')}
                        value={folder.id}
                        style={{ paddingLeft: `${2 + folder.depth * 0.75}rem` }}
                      >
                        {folder.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void trash()}
              >
                <Trash2 />
                Move to trash
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <NameDialog
        open={dialog === 'rename'}
        onOpenChange={close}
        title="Rename canvas"
        initialName={file.name}
        submitLabel="Save"
        onSubmit={(name) => renameFile.mutateAsync({ id: file.id, name })}
      />
      <ConfirmDialog
        open={dialog === 'destroy'}
        onOpenChange={close}
        title={`Delete “${file.name}” permanently?`}
        description="The canvas and its assets will be permanently deleted. This cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={() => destroyFile.mutateAsync({ id: file.id })}
      />
    </>
  )
}
