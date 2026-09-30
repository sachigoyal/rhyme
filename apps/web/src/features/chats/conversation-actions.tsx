import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ChatSummary } from '@rhyme/trpc-client'
import { useDeleteChat, useRenameChat } from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
        <DropdownMenuTrigger
          render={
            variant === 'sidebar' ? (
              <SidebarMenuAction showOnHover {...triggerProps} />
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                className="mr-1 shrink-0 opacity-0 transition-opacity group-hover/conversation:opacity-100 group-focus-within/conversation:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
                {...triggerProps}
              />
            )
          }
        />
        <DropdownMenuContent
          align="start"
          side={variant === 'sidebar' ? 'right' : 'bottom'}
          className="w-auto min-w-28 border shadow-none ring-0"
        >
          <DropdownMenuItem
            onClick={() => setDialog('rename')}
            disabled={locked}
          >
            <Pencil className="size-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog('delete')}
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
        title="Delete conversation?"
        description="Messages and change previews will be permanently deleted. Canvas content will not be changed."
        confirmLabel="Delete conversation"
        onConfirm={async () => {
          await remove.mutateAsync({ id: chat.id })
          onDeleted?.()
        }}
      />
    </>
  )
}
