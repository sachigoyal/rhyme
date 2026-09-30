import { Separator } from '@rhyme/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@rhyme/ui/components/sidebar'
import type { SessionUser } from '@/lib/auth'
import { AppSidebar } from './app-sidebar'
import type { FileView } from '@rhyme/trpc-client'
import { WorkspaceBreadcrumbs } from '@/components/workspace-breadcrumbs'
import type { WorkspaceCrumb } from '@/components/workspace-breadcrumbs'

export function WorkspaceShell({
  user,
  section,
  title,
  chatId,
  hideHeader = false,
  view,
  folderId,
  actions,
  breadcrumbs,
  children,
}: {
  user: SessionUser
  section: 'files' | 'chats' | 'activity' | 'settings'
  title: string
  chatId?: string
  hideHeader?: boolean
  view?: FileView
  folderId?: string
  actions?: React.ReactNode
  breadcrumbs?: WorkspaceCrumb[]
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        section={section}
        chatId={chatId}
        view={view}
        folderId={folderId}
      />
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        {!hideHeader && (
          <header className="bg-card flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-4"
            />
            <WorkspaceBreadcrumbs items={breadcrumbs ?? [{ label: title }]} />
            {actions}
          </header>
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
