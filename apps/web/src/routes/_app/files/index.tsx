import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpDown, Loader2, Plus, Search } from 'lucide-react'
import { z } from 'zod'
import { useFolders } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@rhyme/ui/components/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { displayName } from '@/lib/auth'
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

const titles = {
  mine: 'Your canvases',
  shared: 'Shared with me',
  trash: 'Trash',
}

export const Route = createFileRoute('/_app/files/')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Files · Rhyme' }] }),
  component: FilesPage,
})

function FilesPage() {
  const { view, folder: folderId } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
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
          <span className="text-muted-foreground ml-auto hidden text-xs sm:block">
            A little space for your next big idea.
          </span>
          {view === 'mine' && (
            <Button
              size="sm"
              className="ml-2 shadow-none"
              onClick={() => create(folderId)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              New canvas
            </Button>
          )}
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-10 sm:py-10">
          <div className="mb-8">
            <p className="text-muted-foreground mb-2 text-sm">
              {view === 'mine'
                ? `Workspace / ${displayName(user)}`
                : 'Workspace'}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {view === 'trash'
                ? 'Restore a canvas or make room for something new.'
                : view === 'shared'
                  ? 'A shared space for thinking together.'
                  : 'Everything you’re thinking about, all in one place.'}
            </p>
          </div>
          <div className="mb-6 flex items-center gap-3">
            <InputGroup className="max-w-sm">
              <InputGroupInput
                aria-label="Search canvases"
                placeholder="Search canvases…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto shadow-none"
                >
                  <ArrowUpDown />
                  {sort === 'recent' ? 'Last edited' : 'Name'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => setSort(value as 'recent' | 'name')}
                >
                  <DropdownMenuRadioItem value="recent">
                    Last edited
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">
                    Name
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <FileGrid
            view={view}
            folderId={folderId}
            folders={tree}
            search={search}
            sort={sort}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
