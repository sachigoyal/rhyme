import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Editor } from 'tldraw'
import { useFile } from '@rhyme/hooks/queries'
import { RecoveryState } from '@/components/recovery-state'
import { errorCode, useTRPC } from '@rhyme/trpc-client'
import type { ChatDetail, FileSummary } from '@rhyme/trpc-client'
import { buttonVariants } from '@rhyme/ui/components/button'
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
import { LoadingComposer } from '@/features/agent/chat-loading'
import { ChatTranscript } from '@/features/agent/chat-transcript'
import { Canvas } from '@/features/editor/canvas'
import { documentCache } from '@/features/editor/document-cache'
import { SaveStatus, useSyncStatus } from '@/features/editor/save-status'
import { useDocumentSync } from '@/features/editor/use-document-sync'
import { useInitialDocument } from '@/features/editor/use-initial-document'
import type { InitialDocument } from '@/features/editor/use-initial-document'

export function ConversationSession({
  detail,
  draft,
  onDraft,
  onBusy,
  onComplete,
}: {
  detail: ChatDetail
  draft: string
  onDraft: (text: string) => void
  onBusy: (busy: boolean) => void
  onComplete: () => void
}) {
  const [revision, setRevision] = useState(0)
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const reload = async () => {
    await documentCache.delete(detail.chat.fileId).catch(() => undefined)
    queryClient.removeQueries(
      trpc.files.document.queryFilter({ id: detail.chat.fileId }),
    )
    setRevision((value) => value + 1)
  }

  return (
    <ConversationDocument
      key={revision}
      detail={detail}
      draft={draft}
      onDraft={onDraft}
      onBusy={onBusy}
      onComplete={onComplete}
      onReload={() => void reload()}
    />
  )
}

function ConversationDocument({
  detail,
  draft,
  onDraft,
  onBusy,
  onComplete,
  onReload,
}: {
  detail: ChatDetail
  draft: string
  onDraft: (text: string) => void
  onBusy: (busy: boolean) => void
  onComplete: () => void
  onReload: () => void
}) {
  const file = useFile(detail.chat.fileId)
  const {
    initial,
    failed,
    error: documentError,
  } = useInitialDocument(detail.chat.fileId)

  const unavailable = ['NOT_FOUND', 'FORBIDDEN', 'BAD_REQUEST'].includes(
    errorCode(file.error ?? documentError) ?? '',
  )
  if ((file.isError && (!file.data || unavailable)) || failed)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatTranscript messages={detail.messages} />
        <div className="border-t">
          <RecoveryState
            className="py-8"
            sketch={unavailable ? 'canvas' : 'connection'}
            title={unavailable ? 'Canvas unavailable' : 'Unable to load canvas'}
            description={
              unavailable
                ? 'You can view the messages, but the canvas is no longer accessible.'
                : 'The canvas must load before you can send a message. Try again.'
            }
            onRetry={unavailable ? undefined : async () => onReload()}
          >
            <Link
              to="/files"
              search={{ view: 'mine' }}
              className={buttonVariants({ variant: 'outline' })}
            >
              View canvases
            </Link>
          </RecoveryState>
        </div>
      </div>
    )
  if (!file.data || !initial)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatTranscript messages={detail.messages} />
        <LoadingComposer layout="workspace" draft={draft} onDraft={onDraft} />
      </div>
    )
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
      detail={detail}
      draft={draft}
      onDraft={onDraft}
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
  detail,
  draft,
  onDraft,
  initial,
  conversationId,
  onBusy,
  onComplete,
  onReload,
}: {
  file: FileSummary
  detail: ChatDetail
  draft: string
  onDraft: (text: string) => void
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
          onNew={onReload}
          onRetry={onReload}
          onFailure={() => onBusy(false)}
        >
          <AgentChat
            fileId={file.id}
            conversationId={conversationId}
            editor={editor}
            initialPrompt=""
            initialMessages={detail.messages}
            draft={draft}
            onDraft={onDraft}
            layout="workspace"
            onStatus={() => {}}
            onBusy={onBusy}
            onComplete={onComplete}
          />
        </AgentChatBoundary>
      ) : (
        <>
          <ChatTranscript messages={detail.messages} />
          <LoadingComposer layout="workspace" draft={draft} onDraft={onDraft} />
        </>
      )}
      <AlertDialog open={resolving} onOpenChange={setResolving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Canvas version conflict</AlertDialogTitle>
            <AlertDialogDescription>
              A newer version is available. Load it to discard the assistant’s
              local changes, or overwrite it with those changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onReload}>
              Load latest version
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void sync.keepLocal()
                setResolving(false)
              }}
            >
              Overwrite latest version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
