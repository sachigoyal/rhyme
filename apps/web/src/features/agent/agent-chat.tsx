import type { UIMessage } from 'ai'
import { Component, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { Editor } from 'tldraw'
import { Button } from '@rhyme/ui/components/button'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@rhyme/ui/components/message-scroller'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@rhyme/ui/components/dialog'
import { AIConnectionsSettings } from '../settings/ai-connections'
import { ActivityIndicator, pendingActivity } from './agent-activity'
import { resolveAgentStatus } from './agent-status'
import type { AgentStatus } from './agent-status'
import { AgentMessage } from './agent-message'
import { AgentComposer, AgentEmptyState } from './agent-composer'
import { useCanvasAgent } from './use-canvas-agent'
import { chatComposerLayouts, chatMessageLayouts } from './chat-layout'

export class AgentChatBoundary extends Component<{
  children: ReactNode
  onNew: () => void
  onFailure: () => void
  onRetry?: () => void
}> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.warn('Assistant conversation could not be opened', error)
    this.props.onFailure()
  }

  render() {
    if (this.state.failed)
      return (
        <div className="flex flex-1 flex-col justify-center gap-3 px-5 py-10">
          <AlertTriangle className="size-5 text-muted-foreground" />
          <h3 className="text-sm font-medium">Unable to open conversation</h3>
          <p className="text-muted-foreground text-xs leading-5">
            {this.props.onRetry
              ? 'Try loading this conversation again.'
              : 'Start a new conversation or select one from history.'}
          </p>
          <Button
            variant="outline"
            className="mt-1 w-fit"
            onClick={this.props.onRetry ?? this.props.onNew}
          >
            {this.props.onRetry ? 'Try again' : 'New conversation'}
          </Button>
        </div>
      )
    return this.props.children
  }
}

export function AgentChat({
  fileId,
  conversationId,
  editor,
  initialPrompt,
  initialMessages,
  ready = true,
  creationError,
  onRetryCreation,
  draft: controlledDraft,
  onDraft,
  onStatus,
  onBusy,
  onComplete,
  layout = 'panel',
}: {
  fileId: string
  conversationId: string
  editor: Editor
  initialPrompt: string
  initialMessages: UIMessage[]
  ready?: boolean
  creationError?: string | null
  onRetryCreation?: () => void
  draft?: string
  onDraft?: (text: string) => void
  onStatus: (status: AgentStatus) => void
  onBusy: (busy: boolean) => void
  onComplete: () => void
  layout?: 'panel' | 'workspace'
}) {
  const chat = useCanvasAgent(
    fileId,
    conversationId,
    editor,
    initialMessages,
    ready,
  )
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [localDraft, setLocalDraft] = useState('')
  const draft = controlledDraft ?? localDraft
  const setDraft = onDraft ?? setLocalDraft
  const [firstMessage] = useState<UIMessage | null>(() =>
    initialPrompt
      ? {
          id: crypto.randomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: initialPrompt }],
        }
      : null,
  )
  const initialSent = useRef(false)
  const wasBusy = useRef(false)
  const [completed, setCompleted] = useState(false)
  const completionRef = useRef(onComplete)
  completionRef.current = onComplete
  const waitingToSend =
    Boolean(initialPrompt) &&
    !initialSent.current &&
    !chat.error &&
    !chat.connectionError &&
    !creationError
  const busy = chat.busy || waitingToSend
  const messages =
    chat.messages.length || !firstMessage ? chat.messages : [firstMessage]
  const lastMessageId = chat.messages.at(-1)?.id
  const activity = pendingActivity(messages, busy)
  const status = resolveAgentStatus({
    messages,
    connected: chat.connected,
    busy,
    usingTools: chat.usingTools,
    error: Boolean(chat.error || chat.connectionError || creationError),
    completed,
  })

  useEffect(() => {
    onStatus(status)
  }, [status, onStatus])
  useEffect(() => {
    onBusy(busy)
    if (busy) {
      wasBusy.current = true
      setCompleted(false)
    } else if (wasBusy.current) {
      wasBusy.current = false
      setCompleted(true)
      completionRef.current()
    }
  }, [busy, onBusy])
  useEffect(() => {
    if (!completed) return
    const timer = setTimeout(() => setCompleted(false), 2200)
    return () => clearTimeout(timer)
  }, [completed])

  useEffect(() => {
    if (
      !ready ||
      Boolean(creationError) ||
      !initialPrompt ||
      !chat.connected ||
      initialSent.current
    )
      return
    initialSent.current = true
    if (!chat.send(initialPrompt, undefined, firstMessage?.id)) {
      initialSent.current = false
      setDraft(initialPrompt)
    }
  }, [
    ready,
    creationError,
    chat.connected,
    initialPrompt,
    firstMessage,
    chat.send,
  ])

  const submit = (text = draft) => {
    if (!text.trim() || busy || !chat.connected) return
    if (chat.send(text.trim())) setDraft('')
  }

  return (
    <>
      {chat.quotaExceeded && (
        <div
          role="status"
          className="bg-muted/40 space-y-2 border-b px-4 py-3 text-xs"
        >
          <p className="font-medium">Free AI allowance reached</p>
          <p className="text-muted-foreground leading-5">
            Add your own API key and select its model to keep chatting. Your
            free allowance resets next month (UTC).
          </p>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setConnectionsOpen(true)}
          >
            Add your API key
          </Button>
        </div>
      )}
      <Dialog open={connectionsOpen} onOpenChange={setConnectionsOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Continue with your own API key</DialogTitle>
            <DialogDescription>
              Connect your provider, then choose its model in the assistant.
              Usage is billed to your provider account.
            </DialogDescription>
          </DialogHeader>
          <AIConnectionsSettings />
        </DialogContent>
      </Dialog>
      {chat.connectionError && (
        <div
          role="alert"
          className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-xs"
        >
          <span className="flex-1">Could not connect to the assistant.</span>
          <Button size="xs" variant="outline" onClick={chat.reconnect}>
            Retry connection
          </Button>
        </div>
      )}
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent
              className={messages.length ? chatMessageLayouts[layout] : 'gap-0'}
            >
              {messages.length === 0 ? (
                <MessageScrollerItem messageId="empty">
                  <AgentEmptyState
                    disabled={!chat.connected}
                    onSubmit={submit}
                  />
                </MessageScrollerItem>
              ) : (
                messages.map((message) => (
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    <AgentMessage
                      message={message}
                      editor={editor}
                      live={busy && message.id === lastMessageId}
                      onResolveDeletion={chat.resolveDeletion}
                      onRegenerate={
                        !chat.connected ||
                        busy ||
                        (message.id === firstMessage?.id &&
                          !initialSent.current)
                          ? undefined
                          : (id) => chat.regenerate(id)
                      }
                      onEdit={
                        !chat.connected ||
                        busy ||
                        (message.id === firstMessage?.id &&
                          !initialSent.current)
                          ? undefined
                          : (id, text) => chat.send(text, id)
                      }
                    />
                  </MessageScrollerItem>
                ))
              )}
              {activity && (
                <MessageScrollerItem messageId="activity">
                  <ActivityIndicator label={activity} />
                </MessageScrollerItem>
              )}
              {(chat.error || creationError) &&
                !busy &&
                !chat.quotaExceeded && (
                  <MessageScrollerItem messageId="error">
                    <div className="bg-muted/40 flex items-start gap-2 rounded-xl border p-3 text-xs">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">Response failed</p>
                        <p className="text-muted-foreground mt-1 leading-5">
                          {creationError ?? chat.error?.message ?? 'Try again.'}
                        </p>
                        <Button
                          size="xs"
                          variant="outline"
                          className="mt-2"
                          disabled={!creationError && !chat.connected}
                          onClick={() =>
                            creationError
                              ? onRetryCreation?.()
                              : chat.regenerate()
                          }
                        >
                          <RotateCcw className="size-3" />
                          Try again
                        </Button>
                        {chat.config.connectionId && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="mt-2 ml-2"
                            render={<Link to="/settings" />}
                          >
                            AI settings
                          </Button>
                        )}
                      </div>
                    </div>
                  </MessageScrollerItem>
                )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className={chatComposerLayouts[layout]}>
        <AgentComposer
          draft={draft}
          onDraft={setDraft}
          onSubmit={() => submit()}
          busy={busy}
          connected={chat.connected}
          onStop={chat.busy ? () => void chat.stop() : undefined}
          config={chat.config}
          onConfigure={chat.configure}
        />
      </div>
    </>
  )
}
