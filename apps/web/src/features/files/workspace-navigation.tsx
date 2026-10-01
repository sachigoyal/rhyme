import { Link } from '@tanstack/react-router'
import {
  Activity,
  LayoutGrid,
  MessageSquare,
  Settings,
  Trash2,
  Users,
} from 'lucide-react'
import type { FileView } from '@rhyme/trpc-client'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@rhyme/ui/components/sidebar'

export type WorkspaceSection = 'files' | 'chats' | 'activity' | 'settings'

const items = [
  {
    section: 'files',
    view: 'mine',
    label: 'Canvases',
    icon: LayoutGrid,
    to: '/files',
  },
  {
    section: 'files',
    view: 'shared',
    label: 'Shared with me',
    icon: Users,
    to: '/files',
  },
  {
    section: 'files',
    view: 'trash',
    label: 'Trash',
    icon: Trash2,
    to: '/files',
  },
  {
    section: 'chats',
    label: 'Conversations',
    icon: MessageSquare,
    to: '/chats',
  },
  {
    section: 'activity',
    label: 'Agent activity',
    icon: Activity,
    to: '/activity',
  },
  { section: 'settings', label: 'Settings', icon: Settings, to: '/settings' },
] as const

export function WorkspaceNavigation({
  section,
  view,
  folderId,
  loading = false,
}: {
  section: WorkspaceSection
  view?: FileView
  folderId?: string
  loading?: boolean
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ section: target, label, icon: Icon, to, ...item }) => {
            const targetView = 'view' in item ? item.view : undefined
            const content = (
              <>
                <Icon />
                <span>{label}</span>
              </>
            )
            return (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  isActive={
                    section === target &&
                    (target !== 'files' || (view === targetView && !folderId))
                  }
                  disabled={loading}
                  render={
                    loading ? undefined : (
                      <Link
                        to={to}
                        search={targetView ? { view: targetView } : undefined}
                      />
                    )
                  }
                >
                  {content}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
