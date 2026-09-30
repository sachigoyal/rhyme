import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { SidebarTrigger } from '@rhyme/ui/components/sidebar'
import { WorkspaceBreadcrumbs } from '@/components/workspace-breadcrumbs'

export function ConversationHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <header className="bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger className="-ml-1" />
      <h1 className="sr-only">{title}</h1>
      <WorkspaceBreadcrumbs
        items={[
          {
            label: 'Conversations',
            link: <Link to="/chats">Conversations</Link>,
          },
          { label: title },
        ]}
      />
      {children}
    </header>
  )
}
