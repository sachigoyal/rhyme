import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Plus } from 'lucide-react'
import { z } from 'zod'
import { useFolders } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import { Separator } from '@rhyme/ui/components/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@rhyme/ui/components/sidebar'
import { AppSidebar } from '@/features/files/app-sidebar'
import { FileGrid } from '@/features/files/file-grid'
import {
  buildFolderTree,
  flattenFolderTree,
} from '@/features/files/folder-tree'
import { useCreateAndOpenFile } from '@/features/files/use-create-file'

const searchSchema = z.object({
  view: z.enum(['mine', 'shared', 'trash']).catch('mine').default('mine'),
  folder: z.string().optional(),
})

const titles = { mine: 'All files', shared: 'Shared with me', trash: 'Trash' }

export const Route = createFileRoute('/_app/files/')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Files · Rhyme' }] }),
  component: FilesPage,
})

function FilesPage() {
  const { view, folder: folderId } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const { data: folders } = useFolders()
  const tree = useMemo(
    () => flattenFolderTree(buildFolderTree(folders ?? [])),
    [folders],
  )
  const { create, isPending } = useCreateAndOpenFile()
  const title =
    tree.find((folder) => folder.id === folderId)?.name ?? titles[view]

  return (
    <SidebarProvider>
      <AppSidebar user={user} view={view} folderId={folderId} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-1 data-[orientation=vertical]:h-4"
          />
          <h1 className="truncate text-sm font-medium">{title}</h1>
          {view === 'mine' && (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => create(folderId)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              New file
            </Button>
          )}
        </header>
        <div className="flex-1 p-4 sm:p-6">
          <FileGrid view={view} folderId={folderId} folders={tree} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
