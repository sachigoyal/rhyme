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
import { toast } from 'sonner'
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
}

export function FileCard({ file, folders }: FileCardProps) {
  const trashed = file.trashedAt !== null
  const preview = <FilePreview file={file} />

  return (
    <div className="group bg-card hover:border-foreground/20 relative flex flex-col overflow-hidden rounded-lg border transition-colors">
      {trashed ? (
        preview
      ) : (
        <Link
          to="/files/$fileId"
          params={{ fileId: file.id }}
          className="outline-none"
        >
          {preview}
          <span className="absolute inset-0" aria-hidden />
        </Link>
      )}
      <div className="flex items-center gap-2 border-t px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {file.role === 'owner'
              ? `Edited ${timeAgo(file.updatedAt)}`
              : `${displayName(file.owner)} · ${timeAgo(file.updatedAt)}`}
          </p>
        </div>
        {file.role !== 'owner' && (
          <Badge variant="secondary" className="capitalize">
            {file.role}
          </Badge>
        )}
        {file.role === 'owner' && <FileMenu file={file} folders={folders} />}
      </div>
    </div>
  )
}

function FilePreview({ file }: { file: FileSummary }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="bg-muted/50 relative aspect-[16/10] overflow-hidden">
      {file.hasThumbnail && !failed ? (
        <img
          src={thumbnailUrl(file.id, file.version)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02] dark:invert dark:hue-rotate-180"
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative z-10 -mr-1.5 shrink-0"
            aria-label="File actions"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {trashed ? (
            <>
              <DropdownMenuItem
                onSelect={() =>
                  restoreFile.mutate(
                    { id: file.id },
                    {
                      onSuccess: () => toast.success(`Restored “${file.name}”`),
                    },
                  )
                }
              >
                <RotateCcw />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDialog('destroy')}
              >
                <X />
                Delete forever
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setDialog('rename')}>
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
                onSelect={() =>
                  trashFile.mutate(
                    { id: file.id },
                    {
                      onSuccess: () =>
                        toast(`Moved “${file.name}” to trash`, {
                          action: {
                            label: 'Undo',
                            onClick: () => restoreFile.mutate({ id: file.id }),
                          },
                        }),
                    },
                  )
                }
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
        title="Rename file"
        initialName={file.name}
        submitLabel="Save"
        onSubmit={(name) => renameFile.mutateAsync({ id: file.id, name })}
      />
      <ConfirmDialog
        open={dialog === 'destroy'}
        onOpenChange={close}
        title={`Delete “${file.name}” forever?`}
        description="The drawing and its images are removed permanently. This can't be undone."
        confirmLabel="Delete forever"
        onConfirm={() => destroyFile.mutate({ id: file.id })}
      />
    </>
  )
}
