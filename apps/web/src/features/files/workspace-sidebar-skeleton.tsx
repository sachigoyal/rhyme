import { ChevronsUpDown, FolderPlus } from 'lucide-react'
import type { FileView } from '@rhyme/trpc-client'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@rhyme/ui/components/sidebar'
import { WorkspaceSidebarHeader } from './workspace-frame'
import { WorkspaceNavigation } from './workspace-navigation'
import type { WorkspaceSection } from './workspace-navigation'

export function WorkspaceSidebarSkeleton({
  section,
  view,
}: {
  section: WorkspaceSection
  view: FileView
}) {
  return (
    <Sidebar className="border-r" aria-hidden="true">
      <WorkspaceSidebarHeader pending loading />
      <SidebarContent className="px-1">
        <WorkspaceNavigation section={section} view={view} loading />
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupAction title="New folder" disabled>
            <FolderPlus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarRows count={3} showIcon />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recent conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarRows count={3} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-11 px-2" disabled>
              <Skeleton className="size-7 rounded-full" />
              <div className="grid flex-1 gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function SidebarRows({
  count,
  showIcon = false,
}: {
  count: number
  showIcon?: boolean
}) {
  return (
    <SidebarMenu>
      {Array.from({ length: count }, (_, index) => (
        <SidebarMenuItem key={index}>
          <div className="flex h-8 items-center gap-2 px-2">
            {showIcon && <Skeleton className="size-4" />}
            <Skeleton className="h-4 w-28" />
          </div>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
