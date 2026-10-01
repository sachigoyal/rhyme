import type { SessionUser } from '@/lib/auth'
import { AppSidebar } from './app-sidebar'
import type { FileView } from '@rhyme/trpc-client'
import { WorkspaceFrame } from './workspace-frame'
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
    <WorkspaceFrame
      sidebar={
        <AppSidebar
          user={user}
          section={section}
          chatId={chatId}
          view={view}
          folderId={folderId}
        />
      }
      title={title}
      hideHeader={hideHeader}
      actions={actions}
      breadcrumbs={breadcrumbs}
    >
      {children}
    </WorkspaceFrame>
  )
}
