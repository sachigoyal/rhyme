import { ArrowUpDown } from 'lucide-react'
import type { FileView } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { PageHeading } from '@/components/page-heading'
import { SearchInput } from '@/components/search-input'
import { WorkspacePage } from '@/components/workspace-page'
import { FileGridSkeleton } from './file-grid-skeleton'

export function FilesPageSkeleton({
  title,
  view,
}: {
  title: string
  view: FileView
}) {
  return (
    <WorkspacePage aria-label="Loading canvases">
      <PageHeading
        title={title}
        description={
          view === 'trash'
            ? 'Restore deleted canvases or delete them permanently.'
            : undefined
        }
      />
      <div className="mb-4 flex items-center gap-2" aria-hidden="true">
        <SearchInput
          label="Search canvases"
          value=""
          className="max-w-sm"
          disabled
        />
        <Button variant="outline" size="sm" className="ml-auto" disabled>
          <ArrowUpDown />
          Last edited
        </Button>
      </div>
      <FileGridSkeleton />
    </WorkspacePage>
  )
}
