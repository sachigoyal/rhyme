import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  Activity,
  MessageSquare,
  Plus,
  Folder,
  FolderPlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Settings,
} from 'lucide-react'
import {
  useCreateFolder,
  useDeleteFolder,
  useRenameFolder,
} from '@rhyme/hooks/mutations'
import { useChats, useFolders } from '@rhyme/hooks/queries'
import type { FileView } from '@rhyme/trpc-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@rhyme/ui/components/sidebar'
import { Button } from '@rhyme/ui/components/button'
import { useCreateAndOpenFile } from './use-create-file'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Logo } from '@/components/logo'
import { NameDialog } from '@/components/name-dialog'
import { UserAvatar, UserMenu } from '@/components/user-menu'
import { displayName } from '@/lib/auth'
import { ConversationHoverCard } from '@/features/chats/conversation-hover-card'
import { ConversationActions } from '@/features/chats/conversation-actions'
import type { SessionUser } from '@/lib/auth'
import { buildFolderTree, flattenFolderTree } from './folder-tree'
import type { FolderNode } from './folder-tree'

const views: Array<{ view: FileView; label: string; icon: typeof LayoutGrid }> =
  [
    { view: 'mine', label: 'Canvases', icon: LayoutGrid },
    { view: 'shared', label: 'Shared with me', icon: Users },
    { view: 'trash', label: 'Trash', icon: Trash2 },
  ]

interface AppSidebarProps {
  user: SessionUser
  view?: FileView
  section?: 'files' | 'chats' | 'activity' | 'settings'
  chatId?: string
  folderId?: string
}

export function AppSidebar({
  user,
  view,
  folderId,
  section = 'files',
  chatId,
}: AppSidebarProps) {
  const navigate = useNavigate()
  const { data: chats } = useChats()
  const { create, isPending: creatingCanvas } = useCreateAndOpenFile()
  const { data: folders, isPending } = useFolders()
  const tree = useMemo(
    () => flattenFolderTree(buildFolderTree(folders ?? [])),
    [folders],
  )
  const [creating, setCreating] = useState(false)
  const createFolder = useCreateFolder()

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="gap-3 px-3 py-3">
        <Link to="/" aria-label="Home">
          <Logo />
        </Link>
        <Button
          variant="default"
          className="w-full justify-start gap-2"
          disabled={creatingCanvas}
          onClick={() => create()}
        >
          <Plus className="size-4" />
          New canvas
        </Button>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {views.map(({ view: target, label, icon: Icon }) => (
                <SidebarMenuItem key={target}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      section === 'files' && view === target && !folderId
                    }
                  >
                    <Link to="/files" search={{ view: target }}>
                      <Icon />
                      {label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={section === 'chats'}>
                  <Link to="/chats">
                    <MessageSquare />
                    <span>Conversations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={section === 'activity'}>
                  <Link to="/activity">
                    <Activity />
                    <span>Agent activity</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={section === 'settings'}>
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupAction
            title="New folder"
            onClick={() => setCreating(true)}
          >
            <FolderPlus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {isPending &&
                Array.from({ length: 3 }, (_, index) => (
                  <SidebarMenuSkeleton key={index} showIcon />
                ))}
              {tree.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  active={section === 'files' && folder.id === folderId}
                />
              ))}
              {!isPending && tree.length === 0 && (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">
                  No folders
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recent conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats
                ?.filter((chat) => !chat.id.startsWith('pending:'))
                .slice(0, 5)
                .map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <ConversationHoverCard chat={chat}>
                      <SidebarMenuButton
                        asChild
                        isActive={section === 'chats' && chat.id === chatId}
                      >
                        <Link to="/chats" search={{ chat: chat.id }}>
                          <span className="truncate">{chat.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </ConversationHoverCard>
                    <ConversationActions
                      chat={chat}
                      variant="sidebar"
                      onDeleted={() => {
                        if (chat.id === chatId) void navigate({ to: '/chats' })
                      }}
                    />
                  </SidebarMenuItem>
                ))}
              {chats?.length === 0 && (
                <p className="text-muted-foreground px-2 py-2 text-xs leading-relaxed">
                  No conversations
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user}>
              <SidebarMenuButton className="h-11 px-2">
                <UserAvatar user={user} className="size-7" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {displayName(user)}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </UserMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New folder"
        placeholder="Folder name"
        submitLabel="Create"
        onSubmit={(name) => createFolder.mutateAsync({ name })}
      />
    </Sidebar>
  )
}

function FolderItem({
  folder,
  active,
}: {
  folder: FolderNode
  active: boolean
}) {
  const [dialog, setDialog] = useState<
    'rename' | 'subfolder' | 'delete' | null
  >(null)
  const navigate = useNavigate()
  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <SidebarMenuItem>
      {folder.id.startsWith('pending:') ? (
        <SidebarMenuButton
          disabled
          style={{ paddingLeft: `${0.5 + folder.depth * 0.875}rem` }}
        >
          <Folder />
          <span className="truncate">{folder.name}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          asChild
          isActive={active}
          style={{ paddingLeft: `${0.5 + folder.depth * 0.875}rem` }}
        >
          <Link to="/files" search={{ view: 'mine', folder: folder.id }}>
            <Folder />
            <span className="truncate">{folder.name}</span>
          </Link>
        </SidebarMenuButton>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover
            disabled={folder.id.startsWith('pending:')}
            aria-label={`Options for ${folder.name}`}
          >
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={() => setDialog('subfolder')}>
            <FolderPlus />
            New subfolder
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('rename')}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDialog('delete')}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NameDialog
        open={dialog === 'subfolder'}
        onOpenChange={close}
        title={`New folder in ${folder.name}`}
        placeholder="Folder name"
        submitLabel="Create"
        onSubmit={(name) =>
          createFolder.mutateAsync({ name, parentId: folder.id })
        }
      />
      <NameDialog
        open={dialog === 'rename'}
        onOpenChange={close}
        title="Rename folder"
        initialName={folder.name}
        submitLabel="Save"
        onSubmit={(name) => renameFolder.mutateAsync({ id: folder.id, name })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title={`Delete “${folder.name}”?`}
        description="This folder and its subfolders will be deleted. Their canvases will be kept without a folder."
        confirmLabel="Delete folder"
        onConfirm={async () => {
          await deleteFolder.mutateAsync({ id: folder.id })
          if (active) await navigate({ to: '/files', search: { view: 'mine' } })
        }}
      />
    </SidebarMenuItem>
  )
}
