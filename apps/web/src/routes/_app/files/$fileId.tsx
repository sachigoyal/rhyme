import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useFile } from '@rhyme/hooks/queries'
import { errorCode, useTRPC } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { documentCache } from '@/features/editor/document-cache'
import { EditorSession } from '@/features/editor/editor-session'
import { useInitialDocument } from '@/features/editor/use-initial-document'

export const Route = createFileRoute('/_app/files/$fileId')({
  component: EditorPage,
})

function EditorPage() {
  const { fileId } = Route.useParams()
  const [session, setSession] = useState(0)
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  const reload = async () => {
    await documentCache.delete(fileId)
    await queryClient.resetQueries(
      trpc.files.document.queryFilter({ id: fileId }),
    )
    setSession((value) => value + 1)
  }

  return (
    <EditorLoader
      key={`${fileId}:${session}`}
      fileId={fileId}
      onReload={reload}
    />
  )
}

function EditorLoader({
  fileId,
  onReload,
}: {
  fileId: string
  onReload: () => void
}) {
  const { user } = Route.useRouteContext()
  const file = useFile(fileId)
  const { initial, failed } = useInitialDocument(fileId)

  useEffect(() => {
    if (file.data) document.title = `${file.data.name} · Rhyme`
  }, [file.data])

  useEffect(() => {
    if (initial?.offline)
      toast('You are offline. Editing the copy saved on this device.')
  }, [initial?.offline])

  if (file.isError || failed) {
    const missing =
      errorCode(file.error) === 'NOT_FOUND' ||
      errorCode(file.error) === 'FORBIDDEN'
    return (
      <div className="grid h-svh place-items-center p-6 text-center">
        <div className="space-y-4">
          <h1 className="text-lg font-semibold">
            {missing ? 'File not found' : 'Couldn’t open this file'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {missing
              ? 'It may have been deleted or you no longer have access.'
              : 'Check your connection and try again.'}
          </p>
          <Button asChild variant="outline">
            <Link to="/files" search={{ view: 'mine' }}>
              Back to files
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!file.data || !initial) {
    return (
      <div className="grid h-svh place-items-center">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    )
  }

  return (
    <EditorSession
      file={file.data}
      initial={initial}
      user={user}
      onReload={onReload}
    />
  )
}
