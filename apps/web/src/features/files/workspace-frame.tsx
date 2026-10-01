import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import {
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@rhyme/ui/components/sidebar'
import { Logo } from '@/components/logo'
import { WorkspaceBreadcrumbs } from '@/components/workspace-breadcrumbs'
import type { WorkspaceCrumb } from '@/components/workspace-breadcrumbs'

export function WorkspaceFrame({
  sidebar,
  title,
  hideHeader = false,
  actions,
  breadcrumbs,
  loading = false,
  children,
}: {
  sidebar: ReactNode
  title: string
  hideHeader?: boolean
  actions?: ReactNode
  breadcrumbs?: WorkspaceCrumb[]
  loading?: boolean
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset
        className="h-svh min-w-0 overflow-hidden"
        aria-busy={loading}
      >
        {loading && (
          <span className="sr-only" role="status">
            Loading workspace
          </span>
        )}
        {!hideHeader && (
          <header className="bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger className="-ml-1" />
            <WorkspaceBreadcrumbs items={breadcrumbs ?? [{ label: title }]} />
            {actions}
          </header>
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

export function WorkspaceSidebarHeader({
  pending = false,
  loading = false,
  onCreate,
}: {
  pending?: boolean
  loading?: boolean
  onCreate?: () => void
}) {
  return (
    <SidebarHeader className="gap-0 p-0">
      <Link
        to="/"
        aria-label="Home"
        className="flex h-12 shrink-0 items-center justify-center border-b px-3"
      >
        <Logo loading={loading} />
      </Link>
      <div className="p-3">
        <Button
          size="lg"
          variant="default"
          className="w-full justify-start gap-2"
          disabled={pending}
          onClick={onCreate}
        >
          <Plus className="size-4" />
          New canvas
        </Button>
      </div>
    </SidebarHeader>
  )
}
