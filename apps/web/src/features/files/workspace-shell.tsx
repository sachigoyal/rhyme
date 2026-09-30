import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { Separator } from '@rhyme/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@rhyme/ui/components/sidebar'
import type { SessionUser } from '@/lib/auth'
import { AppSidebar } from './app-sidebar'

export function WorkspaceShell({
  user,
  section,
  title,
  chatId,
  hideHeader = false,
  children,
}: {
  user: SessionUser
  section: 'chats' | 'activity'
  title: string
  chatId?: string
  hideHeader?: boolean
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} section={section} chatId={chatId} />
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        {!hideHeader && (
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-sm font-medium">{title}</h1>
            <Button asChild variant="ghost" size="sm" className="ml-auto">
              <Link to="/">
                Back to canvas
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </header>
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
