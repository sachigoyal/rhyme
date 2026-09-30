import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpDown, Loader2, Plus } from 'lucide-react'
import { z } from 'zod'
import { useFolders } from '@rhyme/hooks/queries'
import { Button, buttonVariants } from '@rhyme/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { WorkspaceShell } from '@/features/files/workspace-shell'
import { RecoveryState } from '@/components/recovery-state'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { PageHeading } from '@/components/page-heading'
import { WorkspacePage } from '@/components/workspace-page'
import { SearchInput } from '@/components/search-input'
import { FileGrid } from '@/features/files/file-grid'
import {
  buildFolderTree,
  flattenFolderTree,
  getFolderPath,
} from '@/features/files/folder-tree'
import { useCreateAndOpenFile } from '@/features/files/use-create-file'

const searchSchema = z.object({
  view: z.enum(['mine', 'shared', 'trash']).catch('mine').default('mine'),
  folder: z.string().optional(),
})

const titles = {
  mine: 'Canvases',
  shared: 'Shared with me',
  trash: 'Trash',
}

export const Route = createFileRoute('/_app/files/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ view: search.view, folderId: search.folder }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(
      context.trpc.files.list.queryOptions(deps),
    )
  },
  component: FilesPage,
})

function FilesPage() {
  const { view, folder: folderId } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
  const folderQuery = useFolders()
  const folders = folderQuery.data
  const tree = useMemo(
    () => flattenFolderTree(buildFolderTree(folders ?? [])),
    [folders],
  )
  const { create, isPending } = useCreateAndOpenFile()
  const activeFolder = tree.find((folder) => folder.id === folderId)
  const missingFolder =
    view === 'mine' && !!folderId && folderQuery.isSuccess && !activeFolder
  const waitingFolder =
    view === 'mine' && !!folderId && !activeFolder && !missingFolder
  const title = missingFolder
    ? 'Folder unavailable'
    : (activeFolder?.name ?? titles[view])
  const folderPath =
    folderId && view === 'mine' ? getFolderPath(folders ?? [], folderId) : []

  return (
    <WorkspaceShell
      user={user}
      section="files"
      view={view}
      folderId={folderId}
      title={title}
      breadcrumbs={
        folderPath.length
          ? [
              {
                label: 'Canvases',
                link: (
                  <Link to="/files" search={{ view: 'mine' }}>
                    Canvases
                  </Link>
                ),
              },
              ...folderPath.map((folder, index) => ({
                label: folder.name,
                link:
                  index < folderPath.length - 1 ? (
                    <Link
                      to="/files"
                      search={{ view: 'mine', folder: folder.id }}
                    >
                      {folder.name}
                    </Link>
                  ) : undefined,
              })),
            ]
          : undefined
      }
      actions={
        view === 'mine' && !missingFolder && !waitingFolder ? (
          <Button
            size="sm"
            onClick={() => create(folderId)}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            New canvas
          </Button>
        ) : undefined
      }
    >
      {missingFolder ? (
        <RecoveryState
          sketch="folder"
          title="Folder not found"
          description="This folder may have been deleted. Return to your canvases to continue."
        >
          <Link
            to="/files"
            search={{ view: 'mine' }}
            className={buttonVariants({})}
          >
            View canvases
          </Link>
        </RecoveryState>
      ) : waitingFolder ? (
        <WorkspacePage aria-label="Loading folder">
          {folderQuery.isError ? (
            <RecoveryState
              title="Unable to load folders"
              description="Try again to open this folder."
              onRetry={async () => {
                const result = await folderQuery.refetch()
                if (result.error) throw result.error
              }}
            />
          ) : (
            <Skeleton className="h-64" />
          )}
        </WorkspacePage>
      ) : (
        <WorkspacePage aria-label={title}>
          <PageHeading
            title={title}
            description={
              view === 'trash'
                ? 'Restore deleted canvases or delete them permanently.'
                : undefined
            }
          />
          <div className="mb-4 flex items-center gap-2">
            <SearchInput
              label="Search canvases"
              value={search}
              onChange={setSearch}
              className="max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="ml-auto">
                    <ArrowUpDown />
                    {sort === 'recent' ? 'Last edited' : 'Name'}
                  </Button>
                }
              />
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
        </WorkspacePage>
      )}
    </WorkspaceShell>
  )
}
