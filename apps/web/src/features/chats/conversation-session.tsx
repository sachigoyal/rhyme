import { Suspense, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Editor } from 'tldraw'
import { useFile } from '@rhyme/hooks/queries'
import { useCreateChat } from '@rhyme/hooks/mutations'
import { useTRPC } from '@rhyme/trpc-client'
import type { ChatDetail, FileSummary } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@rhyme/ui/components/alert-dialog'
import { AgentChat, AgentChatBoundary } from '@/features/agent/agent-chat'
import { MessagesSkeleton } from '@/features/agent/agent-activity'
import { ChatTranscript } from '@/features/agent/chat-transcript'
import { Canvas } from '@/features/editor/canvas'
import { documentCache } from '@/features/editor/document-cache'
import { SaveStatus, useSyncStatus } from '@/features/editor/save-status'
import { useDocumentSync } from '@/features/editor/use-document-sync'
import { useInitialDocument } from '@/features/editor/use-initial-document'
import type { InitialDocument } from '@/features/editor/use-initial-document'

export function ConversationSession({
  detail,
  onBusy,
  onComplete,
}: {
  detail: ChatDetail
  onBusy: (busy: boolean) => void
  onComplete: () => void
}) {
  const [revision, setRevision] = useState(0)
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const reload = async () => {
    await documentCache.delete(detail.chat.fileId)
    await queryClient.resetQueries(
      trpc.files.document.queryFilter({ id: detail.chat.fileId }),
    )
    setRevision((value) => value + 1)
  }

  return (
    <ConversationDocument
      key={revision}
      detail={detail}
      onBusy={onBusy}
      onComplete={onComplete}
      onReload={() => void reload()}
    />
  )
}

function ConversationDocument({
  detail,
  onBusy,
  onComplete,
  onReload,
}: {
  detail: ChatDetail
  onBusy: (busy: boolean) => void
  onComplete: () => void
  onReload: () => void
}) {
  const file = useFile(detail.chat.fileId)
  const { initial, failed } = useInitialDocument(detail.chat.fileId)

  if (file.isError || failed)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatTranscript messages={detail.messages} />
        <div className="space-y-3 border-t p-5 text-sm">
          <p className="text-muted-foreground">
            Couldn’t load the canvas needed to continue this conversation.
          </p>
          <Button variant="outline" size="sm" onClick={onReload}>
            Try again
          </Button>
        </div>
      </div>
    )
  if (!file.data || !initial) return <MessagesSkeleton />
  if (file.data.role === 'viewer')
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatTranscript messages={detail.messages} />
        <p className="text-muted-foreground border-t p-5 text-sm">
          Editor access is required to continue this conversation.
        </p>
      </div>
    )

  return (
    <LiveConversation
      file={file.data}
      initial={initial}
      conversationId={detail.chat.id}
      onBusy={onBusy}
      onComplete={onComplete}
      onReload={onReload}
    />
  )
}

function LiveConversation({
  file,
  initial,
  conversationId,
  onBusy,
  onComplete,
  onReload,
}: {
  file: FileSummary
  initial: InitialDocument
  conversationId: string
  onBusy: (busy: boolean) => void
  onComplete: () => void
  onReload: () => void
}) {
  const sync = useDocumentSync(file.id, initial, true)!
  const syncStatus = useSyncStatus(sync)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [resolving, setResolving] = useState(false)
  const createChat = useCreateChat()
  const navigate = useNavigate()
  const start = async () => {
    try {
      const chat = await createChat.mutateAsync({ fileId: file.id })
      await navigate({ to: '/chats', search: { chat: chat.id } })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not start a conversation',
      )
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none fixed -left-[10000px] top-0 h-[800px] w-[1280px] overflow-hidden"
      >
        <Canvas
          fileId={file.id}
          initial={initial}
          sync={sync}
          onReady={setEditor}
          headless
        />
      </div>
      {['error', 'offline', 'conflict'].includes(syncStatus) && (
        <div className="flex shrink-0 items-center justify-end border-b px-5 py-2">
          <SaveStatus sync={sync} onResolve={() => setResolving(true)} />
        </div>
      )}
      {editor ? (
        <AgentChatBoundary
          onNew={() => void start()}
          onFailure={() => onBusy(false)}
        >
          <Suspense fallback={<MessagesSkeleton />}>
            <AgentChat
              fileId={file.id}
              conversationId={conversationId}
              editor={editor}
              initialPrompt=""
              layout="workspace"
              onStatus={() => {}}
              onBusy={onBusy}
              onComplete={onComplete}
            />
          </Suspense>
        </AgentChatBoundary>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      )}
      <AlertDialog open={resolving} onOpenChange={setResolving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              This canvas changed somewhere else
            </AlertDialogTitle>
            <AlertDialogDescription>
              Keep the assistant’s changes to overwrite the newer version, or
              load the latest canvas before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onReload}>
              Load latest
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void sync.keepLocal()}>
              Keep mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
