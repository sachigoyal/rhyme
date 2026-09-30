import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ChatSummary } from '@rhyme/trpc-client'
import { useDeleteChat, useRenameChat } from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { SidebarMenuAction } from '@rhyme/ui/components/sidebar'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { NameDialog } from '@/components/name-dialog'

export function ConversationActions({
  chat,
  disabled = false,
  onDeleted,
  variant = 'row',
}: {
  chat: Pick<ChatSummary, 'id' | 'title' | 'fileId' | 'status'>
  disabled?: boolean
  onDeleted?: () => void
  variant?: 'sidebar' | 'row'
}) {
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const rename = useRenameChat()
  const remove = useDeleteChat()
  const locked =
    disabled ||
    chat.status === 'running' ||
    remove.isPending ||
    rename.isPending
  const triggerProps = {
    'aria-label': `Options for ${chat.title}`,
    disabled: locked,
    children: <MoreHorizontal className="size-3.5" />,
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === 'sidebar' ? (
            <SidebarMenuAction showOnHover {...triggerProps} />
          ) : (
            <Button
              variant="ghost"
              size="icon-xs"
              className="mr-1 shrink-0 opacity-0 transition-opacity group-hover/conversation:opacity-100 group-focus-within/conversation:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
              {...triggerProps}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={variant === 'sidebar' ? 'right' : 'bottom'}
          className="w-40 border shadow-none ring-0"
        >
          <DropdownMenuItem asChild>
            <Link
              to="/files/$fileId"
              params={{ fileId: chat.fileId }}
              search={{ chat: chat.id }}
            >
              <ArrowUpRight className="size-3.5" />
              Open canvas
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDialog('rename')}
            disabled={locked}
          >
            <Pencil className="size-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDialog('delete')}
            disabled={locked}
          >
            <Trash2 className="size-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={dialog === 'rename'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Rename conversation"
        initialName={chat.title}
        submitLabel="Save"
        onSubmit={(title) => rename.mutateAsync({ id: chat.id, title })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Delete this conversation?"
        description="This removes its messages and change previews. Your canvas stays as it is."
        confirmLabel="Delete conversation"
        onConfirm={() =>
          remove.mutate(
            { id: chat.id },
            {
              onSuccess: onDeleted,
              onError: (error) =>
                toast.error(
                  error.message || 'Could not delete the conversation',
                ),
            },
          )
        }
      />
    </>
  )
}
