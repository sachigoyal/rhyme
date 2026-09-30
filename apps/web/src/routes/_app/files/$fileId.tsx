import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { RecoveryPage, RecoveryState } from '@/components/recovery-state'
import { CanvasSkeleton } from '@/components/loading-states'
import { z } from 'zod'
import { toast } from 'sonner'
import { useFile } from '@rhyme/hooks/queries'
import { errorCode, useTRPC } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import { documentCache } from '@/features/editor/document-cache'
import { EditorSession } from '@/features/editor/editor-session'
import { useInitialDocument } from '@/features/editor/use-initial-document'

export const Route = createFileRoute('/_app/files/$fileId')({
  validateSearch: z.object({ chat: z.string().optional() }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      context.trpc.files.get.queryOptions({ id: params.fileId }),
    )
  },
  component: EditorPage,
})

function EditorPage() {
  const { fileId } = Route.useParams()
  const [session, setSession] = useState(0)
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  const reload = async () => {
    await documentCache.delete(fileId).catch(() => undefined)
    queryClient.removeQueries(trpc.files.document.queryFilter({ id: fileId }))
    queryClient.removeQueries(trpc.files.get.queryFilter({ id: fileId }))
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
  const { chat } = Route.useSearch()
  const file = useFile(fileId)
  const { initial, failed, error: documentError } = useInitialDocument(fileId)

  useEffect(() => {
    if (file.data) document.title = `${file.data.name} · Rhyme`
  }, [file.data])

  useEffect(() => {
    if (initial?.offline)
      toast('Offline. Editing the version saved on this device.')
  }, [initial?.offline])

  const code = errorCode(file.error ?? documentError)
  const forbidden = code === 'FORBIDDEN'
  const missing = code === 'NOT_FOUND' || code === 'BAD_REQUEST'
  if ((file.isError && (!file.data || forbidden || missing)) || failed) {
    return (
      <RecoveryPage>
        <RecoveryState
          sketch={forbidden ? 'access' : missing ? 'canvas' : 'connection'}
          title={
            forbidden
              ? 'Access denied'
              : missing
                ? 'Canvas unavailable'
                : 'Unable to load canvas'
          }
          description={
            forbidden
              ? 'You don’t have access to this canvas. Ask the owner to share it with you.'
              : missing
                ? 'This canvas may have been deleted, or you may no longer have access. Ask the owner for a new link.'
                : 'Check your connection and try again.'
          }
          onRetry={missing || forbidden ? undefined : async () => onReload()}
        >
          <Button
            asChild
            variant={missing || forbidden ? 'default' : 'outline'}
          >
            <Link to="/files" search={{ view: 'mine' }}>
              View canvases
            </Link>
          </Button>
        </RecoveryState>
      </RecoveryPage>
    )
  }

  if (!file.data || !initial) {
    return <CanvasSkeleton title={file.data?.name} />
  }

  return (
    <EditorSession
      file={file.data}
      initial={initial}
      user={user}
      onReload={onReload}
      chatId={chat}
    />
  )
}
