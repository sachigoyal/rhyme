import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  History,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { Editor } from 'tldraw'
import { useChats, useChat } from '@rhyme/hooks/queries'
import {
  useCreateChat,
  useDeleteChat,
  useRenameChat,
} from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import { Input } from '@rhyme/ui/components/input'
import { ScrollArea } from '@rhyme/ui/components/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { toast } from '@rhyme/ui/components/toast'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ConversationHoverCard } from '@/features/chats/conversation-hover-card'
import { ConversationActions } from '@/features/chats/conversation-actions'
import { LoadingComposer } from './chat-loading'
import { useAssistantPreferences } from './assistant-preferences'
import { AgentFace } from './agent-face'
import { agentStatusLabels } from './agent-status'
import type { AgentStatus } from './agent-status'
import { AgentChat, AgentChatBoundary } from './agent-chat'
import { AgentComposer, AgentEmptyState } from './agent-composer'

interface AgentPanelProps {
  fileId: string
  editor: Editor
  onClose: () => void
  initialChatId?: string
  onBusyChange?: (busy: boolean) => void
  onStateChange?: (status: AgentStatus) => void
}

export function AgentPanel({
  fileId,
  editor,
  onClose,
  initialChatId,
  onBusyChange,
  onStateChange,
}: AgentPanelProps) {
  const chats = useChats({ fileId })
  const createChat = useCreateChat()
  const deleteChat = useDeleteChat()
  const renameChat = useRenameChat()
  const [activeId, setActiveId] = useState<string | null>(initialChatId ?? null)
  const [initialPrompt, setInitialPrompt] = useState('')
  const [draft, setDraft] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)
  const creationInFlight = useRef(false)
  const [history, setHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const initialized = useRef(Boolean(initialChatId))
  const requestedChat = useRef(initialChatId)
  const active = chats.data?.find((chat) => chat.id === activeId)

  useEffect(() => {
    if (initialized.current || !chats.data || draft) return
    initialized.current = true
    setActiveId(chats.data[0]?.id ?? null)
  }, [chats.data, draft])

  useEffect(() => {
    if (!initialChatId || requestedChat.current === initialChatId || busy)
      return
    requestedChat.current = initialChatId
    initialized.current = true
    setCreatedId(null)
    setCreationError(null)
    setActiveId(initialChatId)
    setDraft('')
    setInitialPrompt('')
    setHistory(false)
    setRenaming(false)
  }, [initialChatId, busy])

  useEffect(() => {
    onStateChange?.(status)
  }, [onStateChange, status])
  useEffect(() => {
    onBusyChange?.(busy)
  }, [onBusyChange, busy])
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])

  const create = async (id: string) => {
    if (creationInFlight.current) return
    creationInFlight.current = true
    setCreating(true)
    setCreationError(null)
    setBusy(true)
    try {
      await createChat.mutateAsync({ fileId, id })
      setCreating(false)
    } catch (error) {
      setCreating(false)
      setBusy(false)
      setStatus('error')
      setCreationError(
        error instanceof Error
          ? error.message
          : 'Could not start a conversation',
      )
    } finally {
      creationInFlight.current = false
    }
  }

  const start = (prompt = '') => {
    if (busy || creationInFlight.current) return
    initialized.current = true
    setDraft('')
    setHistory(false)
    setRenaming(false)
    setCreationError(null)
    setInitialPrompt(prompt.trim())
    if (!prompt.trim()) {
      setActiveId(null)
      setStatus('idle')
      return
    }
    const id = crypto.randomUUID()
    setCreatedId(id)
    setActiveId(id)
    setStatus('connecting')
    void create(id)
  }

  const remove = async (id: string) => {
    await deleteChat.mutateAsync({ id })
    if (activeId === id) {
      setActiveId(null)
      setDraft('')
      setInitialPrompt('')
      setStatus('idle')
    }
  }

  return (
    <section
      className="bg-background flex h-full min-h-0 flex-col"
      aria-label="Rhyme"
    >
      <div className="flex shrink-0 items-center gap-2 border-b p-2">
        <AgentFace status={status} className="size-8" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">Rhyme</h2>
          {status !== 'idle' && (
            <p className="text-muted-foreground text-[11px]" role="status">
              {agentStatusLabels[status]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Conversation history"
            aria-pressed={history}
            onClick={() => setHistory(!history)}
          >
            <History className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            disabled={busy || createChat.isPending}
            onClick={() => void start()}
          >
            {createChat.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close Rhyme"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {history && (
        <ScrollArea
          className="flex-1"
          viewportClassName="[&>div]:block!"
          viewportProps={{ 'aria-label': 'Canvas conversations' }}
        >
          <div className="p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-muted-foreground text-xs font-medium">
                Conversations on this canvas
              </p>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Back to conversation"
                onClick={() => setHistory(false)}
              >
                <ArrowLeft className="size-3" />
              </Button>
            </div>
            {chats.isPending ? (
              <p className="p-3 text-xs text-muted-foreground" role="status">
                Loading conversations…
              </p>
            ) : chats.isError ? (
              <div className="space-y-2 p-3 text-sm">
                <p className="text-muted-foreground">
                  Couldn’t load conversations.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void chats.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : !chats.data.length ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <MessageSquare className="size-6 text-muted-foreground" />
                <p className="text-sm">No conversations</p>
                <p className="text-muted-foreground text-xs leading-5">
                  Start a conversation using the New conversation button.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {chats.data.map((chat) => (
                  <div
                    key={chat.id}
                    className={`group/conversation flex h-9 items-center rounded-lg ${chat.id === activeId ? 'bg-muted' : 'hover:bg-muted/60 has-[[aria-haspopup=menu][aria-expanded=true]]:bg-muted'}`}
                  >
                    <ConversationHoverCard chat={chat} side="left">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left disabled:opacity-50"
                        disabled={busy && chat.id !== activeId}
                        onClick={() => {
                          if (chat.id === activeId) {
                            setHistory(false)
                            return
                          }
                          initialized.current = true
                          setStatus('connecting')
                          setCreatedId(null)
                          setCreationError(null)
                          setActiveId(chat.id)
                          setDraft('')
                          setInitialPrompt('')
                          setHistory(false)
                        }}
                      >
                        <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                        <span className="truncate text-sm">{chat.title}</span>
                      </button>
                    </ConversationHoverCard>
                    <ConversationActions
                      chat={chat}
                      disabled={busy}
                      onDeleted={() => {
                        if (activeId !== chat.id) return
                        setActiveId(null)
                        setDraft('')
                        setInitialPrompt('')
                        setStatus('idle')
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className={history ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        {activeId && (
          <div className="flex h-9 shrink-0 items-center gap-2 px-3">
            {renaming ? (
              <form
                className="flex flex-1 items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!title.trim()) return
                  renameChat.mutate(
                    { id: activeId, title: title.trim() },
                    {
                      onSuccess: () => setRenaming(false),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }}
              >
                <Input
                  autoFocus
                  aria-label="Conversation title"
                  className="h-7 text-xs"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <Button
                  size="icon-xs"
                  variant="ghost"
                  type="submit"
                  aria-label="Save title"
                  disabled={renameChat.isPending}
                >
                  <Check className="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  type="button"
                  aria-label="Cancel rename"
                  onClick={() => setRenaming(false)}
                >
                  <X className="size-3" />
                </Button>
              </form>
            ) : (
              <>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] leading-6">
                  {active?.title ?? 'New conversation'}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Conversation options"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-auto min-w-28">
                    <DropdownMenuItem
                      disabled={busy || Boolean(creationError)}
                      onClick={() => {
                        setTitle(active?.title ?? 'New conversation')
                        setRenaming(true)
                      }}
                    >
                      <Pencil />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busy || Boolean(creationError)}
                      onClick={() => setDeletingId(activeId)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
        {activeId ? (
          <AgentChatBoundary
            key={activeId}
            onNew={() => start()}
            onFailure={() => {
              setStatus('error')
              setBusy(false)
            }}
          >
            {activeId === createdId ? (
              <AgentChat
                fileId={fileId}
                conversationId={activeId}
                editor={editor}
                initialPrompt={initialPrompt}
                initialMessages={[]}
                ready={!creating && !creationError}
                creationError={creationError}
                onRetryCreation={() => void create(activeId)}
                draft={draft}
                onDraft={setDraft}
                onStatus={setStatus}
                onBusy={setBusy}
                onComplete={() => void chats.refetch()}
              />
            ) : (
              <ExistingChat
                fileId={fileId}
                id={activeId}
                editor={editor}
                draft={draft}
                onDraft={setDraft}
                onStatus={setStatus}
                onBusy={setBusy}
                onComplete={() => void chats.refetch()}
              />
            )}
          </AgentChatBoundary>
        ) : (
          <EmptyChat
            pending={createChat.isPending}
            draft={draft}
            onDraft={setDraft}
            onSubmit={(prompt) => start(prompt)}
          />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null)
        }}
        title="Delete conversation?"
        description="Messages and change previews will be permanently deleted. Canvas content will not be changed."
        confirmLabel="Delete conversation"
        onConfirm={async () => {
          if (deletingId) await remove(deletingId)
        }}
      />
    </section>
  )
}

function EmptyChat({
  pending,
  draft,
  onDraft,
  onSubmit,
}: {
  pending: boolean
  draft: string
  onDraft: (text: string) => void
  onSubmit: (text: string) => void
}) {
  const { config, configure } = useAssistantPreferences()
  const submit = (text = draft) => {
    if (text.trim() && !pending) onSubmit(text.trim())
  }
  return (
    <>
      <ScrollArea
        className="flex-1"
        viewportClassName="[&>div]:block!"
        viewportProps={{ 'aria-label': 'Assistant suggestions' }}
      >
        <AgentEmptyState disabled={pending} onSubmit={submit} />
      </ScrollArea>
      <AgentComposer
        draft={draft}
        onDraft={onDraft}
        onSubmit={() => submit()}
        connected={!pending}
        config={config}
        onConfigure={configure}
      />
    </>
  )
}

function ExistingChat({
  fileId,
  id,
  editor,
  draft,
  onDraft,
  onStatus,
  onBusy,
  onComplete,
}: {
  fileId: string
  id: string
  editor: Editor
  draft: string
  onDraft: (text: string) => void
  onStatus: (status: AgentStatus) => void
  onBusy: (busy: boolean) => void
  onComplete: () => void
}) {
  const detail = useChat(id)
  if (!detail.data)
    return (
      <>
        <div
          className="flex-1 px-4 py-3 text-xs text-muted-foreground"
          role={detail.isError ? 'alert' : 'status'}
        >
          {detail.isError ? (
            <>
              {detail.error.message}
              <Button
                size="xs"
                variant="outline"
                className="ml-2"
                onClick={() => void detail.refetch()}
              >
                Try again
              </Button>
            </>
          ) : (
            'Loading messages…'
          )}
        </div>
        <LoadingComposer draft={draft} onDraft={onDraft} />
      </>
    )
  return (
    <AgentChat
      fileId={fileId}
      conversationId={id}
      editor={editor}
      initialPrompt=""
      initialMessages={detail.data.messages}
      draft={draft}
      onDraft={onDraft}
      onStatus={onStatus}
      onBusy={onBusy}
      onComplete={onComplete}
    />
  )
}
