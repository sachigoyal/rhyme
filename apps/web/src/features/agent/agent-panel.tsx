import { Suspense, useEffect, useRef, useState } from 'react'
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
import { DEFAULT_AGENT_CONFIG } from 'api/agent-config'
import type { AgentConfig } from 'api/agent-config'
import { useChats } from '@rhyme/hooks/queries'
import {
  useCreateChat,
  useDeleteChat,
  useRenameChat,
} from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import { Input } from '@rhyme/ui/components/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ConversationHoverCard } from '@/features/chats/conversation-hover-card'
import { ConversationActions } from '@/features/chats/conversation-actions'
import { MessagesSkeleton } from './agent-activity'
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
  const [initialConfig, setInitialConfig] = useState<AgentConfig>()
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
    if (initialized.current || !chats.data) return
    initialized.current = true
    setActiveId(chats.data[0]?.id ?? null)
  }, [chats.data])

  useEffect(() => {
    if (!initialChatId || requestedChat.current === initialChatId || busy)
      return
    requestedChat.current = initialChatId
    initialized.current = true
    setActiveId(initialChatId)
    setInitialPrompt('')
    setInitialConfig(undefined)
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

  const start = async (prompt = '', config?: AgentConfig) => {
    if (busy || createChat.isPending) return
    setStatus('connecting')
    try {
      const chat = await createChat.mutateAsync({ fileId })
      setInitialPrompt(prompt)
      setInitialConfig(config)
      setActiveId(chat.id)
      setHistory(false)
    } catch (error) {
      setStatus('error')
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not start a conversation',
      )
    }
  }

  const remove = async (id: string) => {
    await deleteChat.mutateAsync({ id })
    if (activeId === id) {
      setActiveId(null)
      setInitialPrompt('')
      setInitialConfig(undefined)
      setStatus('idle')
    }
  }

  return (
    <section
      className="bg-background flex h-full min-h-0 flex-col"
      aria-label="Canvas assistant"
    >
      <div className="bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <AgentFace status={status} className="size-8" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">Rhyme assistant</h2>
          <p className="text-muted-foreground text-[11px]" role="status">
            {status === 'idle'
              ? 'Draw, edit, and organize shapes'
              : agentStatusLabels[status]}
          </p>
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
            aria-label="Close assistant"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {history && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
            <MessagesSkeleton />
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
                  className={`group/conversation flex h-9 items-center rounded-lg ${chat.id === activeId ? 'bg-muted' : 'hover:bg-muted/60'}`}
                >
                  <ConversationHoverCard chat={chat} side="left">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left disabled:opacity-50"
                      disabled={busy && chat.id !== activeId}
                      onClick={() => {
                        setStatus('connecting')
                        setActiveId(chat.id)
                        setInitialPrompt('')
                        setInitialConfig(undefined)
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
                      setInitialPrompt('')
                      setInitialConfig(undefined)
                      setStatus('idle')
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
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
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Conversation options"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-auto min-w-28">
                    <DropdownMenuItem
                      disabled={busy}
                      onSelect={() => {
                        setTitle(active?.title ?? 'New conversation')
                        setRenaming(true)
                      }}
                    >
                      <Pencil />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busy}
                      onSelect={() => setDeletingId(activeId)}
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
        {chats.isPending && !activeId ? (
          <MessagesSkeleton />
        ) : activeId ? (
          <AgentChatBoundary
            key={activeId}
            onNew={() => void start()}
            onFailure={() => {
              setStatus('error')
              setBusy(false)
            }}
          >
            <Suspense fallback={<MessagesSkeleton />}>
              <AgentChat
                fileId={fileId}
                conversationId={activeId}
                editor={editor}
                initialPrompt={initialPrompt}
                initialConfig={initialConfig}
                onStatus={setStatus}
                onBusy={setBusy}
                onComplete={() => void chats.refetch()}
              />
            </Suspense>
          </AgentChatBoundary>
        ) : (
          <EmptyChat
            pending={createChat.isPending}
            onSubmit={(prompt, config) => void start(prompt, config)}
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
  onSubmit,
}: {
  pending: boolean
  onSubmit: (text: string, config: AgentConfig) => void
}) {
  const [draft, setDraft] = useState('')
  const [config, setConfig] = useState(DEFAULT_AGENT_CONFIG)
  const submit = (text = draft) => {
    if (text.trim() && !pending) onSubmit(text.trim(), config)
  }
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentEmptyState
          status={pending ? 'connecting' : 'idle'}
          disabled={pending}
          onSubmit={submit}
        />
      </div>
      <AgentComposer
        draft={draft}
        onDraft={setDraft}
        onSubmit={() => submit()}
        connected={!pending}
        config={config}
        onConfigure={async (nextConfig) => {
          setConfig(nextConfig)
          return true
        }}
      />
    </>
  )
}
