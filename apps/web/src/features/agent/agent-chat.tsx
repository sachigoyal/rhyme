import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Download, Loader2, RotateCcw } from 'lucide-react'
import type { Editor } from 'tldraw'
import type { AgentConfig } from 'api/agent-config'
import { Button } from '@rhyme/ui/components/button'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@rhyme/ui/components/message-scroller'
import { ActivityIndicator, pendingActivity } from './agent-activity'
import { resolveAgentStatus } from './agent-status'
import type { AgentStatus } from './agent-status'
import { AgentMessage } from './agent-message'
import { AgentComposer, AgentEmptyState } from './agent-composer'
import { useCanvasAgent } from './use-canvas-agent'

export class AgentChatBoundary extends Component<{
  children: ReactNode
  onNew: () => void
  onFailure: () => void
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
            Start a new conversation or select one from history.
          </p>
          <Button
            variant="outline"
            className="mt-1 w-fit"
            onClick={this.props.onNew}
          >
            New conversation
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
  initialConfig,
  onStatus,
  onBusy,
  onComplete,
  layout = 'panel',
}: {
  fileId: string
  conversationId: string
  editor: Editor
  initialPrompt: string
  initialConfig?: AgentConfig
  onStatus: (status: AgentStatus) => void
  onBusy: (busy: boolean) => void
  onComplete: () => void
  layout?: 'panel' | 'workspace'
}) {
  const chat = useCanvasAgent(fileId, conversationId, editor)
  const [draft, setDraft] = useState('')
  const initialSent = useRef(false)
  const wasBusy = useRef(false)
  const [completed, setCompleted] = useState(false)
  const completionRef = useRef(onComplete)
  completionRef.current = onComplete
  const busy = chat.busy
  const lastMessageId = chat.messages.at(-1)?.id
  const activity = pendingActivity(chat.messages, busy)
  const status = resolveAgentStatus({
    messages: chat.messages,
    connected: chat.connected,
    busy,
    usingTools: chat.usingTools,
    error: Boolean(chat.error || chat.connectionError),
    completed,
  })

  useEffect(() => {
    onStatus(status)
  }, [status, onStatus])
  useEffect(() => {
    onBusy(busy || chat.configSaving)
    if (busy) {
      wasBusy.current = true
      setCompleted(false)
    } else if (wasBusy.current) {
      wasBusy.current = false
      setCompleted(true)
      completionRef.current()
    }
  }, [busy, chat.configSaving, onBusy])
  useEffect(() => {
    if (!completed) return
    const timer = setTimeout(() => setCompleted(false), 2200)
    return () => clearTimeout(timer)
  }, [completed])

  useEffect(() => {
    if (
      !initialPrompt ||
      !chat.connected ||
      chat.configSaving ||
      initialSent.current
    )
      return
    initialSent.current = true
    void (async () => {
      const configured = initialConfig
        ? await chat.configure(initialConfig)
        : true
      if (!configured || !chat.send(initialPrompt)) setDraft(initialPrompt)
    })()
  }, [
    chat.connected,
    chat.configSaving,
    initialPrompt,
    initialConfig,
    chat.configure,
    chat.send,
  ])

  const submit = (text = draft) => {
    if (!text.trim() || busy || !chat.connected || chat.configSaving) return
    if (chat.send(text.trim())) setDraft('')
  }

  const exportTranscript = () => {
    const text = chat.messages
      .map(
        (message) =>
          `## ${message.role === 'user' ? 'You' : 'Rhyme'}\n\n${message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n')}`,
      )
      .join('\n\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'rhyme-conversation.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {chat.connectionError && (
        <div
          role="status"
          className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-xs"
        >
          <Loader2 className="size-3 animate-spin" />
          Connection interrupted. Reconnecting…
        </div>
      )}
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent
              className={
                chat.messages.length
                  ? `gap-5 px-4 py-5 ${layout === 'workspace' ? 'mx-auto w-full max-w-3xl sm:px-8 sm:py-8' : ''}`
                  : 'gap-0'
              }
            >
              {chat.messages.length === 0 ? (
                <MessageScrollerItem messageId="empty">
                  <AgentEmptyState
                    status={status}
                    disabled={!chat.connected || chat.configSaving}
                    onSubmit={submit}
                  />
                </MessageScrollerItem>
              ) : (
                chat.messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === 'user'}
                  >
                    <AgentMessage
                      message={message}
                      editor={editor}
                      live={busy && message.id === lastMessageId}
                      onResolveDeletion={chat.resolveDeletion}
                      onRegenerate={
                        busy || chat.configSaving
                          ? undefined
                          : (id) => chat.regenerate(id)
                      }
                      onEdit={
                        busy || chat.configSaving
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
              {chat.error && !busy && (
                <MessageScrollerItem messageId="error">
                  <div className="bg-muted/40 flex items-start gap-2 rounded-xl border p-3 text-xs">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Response failed</p>
                      <p className="text-muted-foreground mt-1 leading-5">
                        {chat.error.message || 'Try again.'}
                      </p>
                      <Button
                        size="xs"
                        variant="outline"
                        className="mt-2"
                        disabled={!chat.connected || chat.configSaving}
                        onClick={() => chat.regenerate()}
                      >
                        <RotateCcw className="size-3" />
                        Try again
                      </Button>
                    </div>
                  </div>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      {layout === 'panel' && chat.messages.length > 0 && !busy && (
        <div className="flex shrink-0 items-center justify-between px-4 pb-2">
          <span className="text-muted-foreground text-[10px]">
            {chat.messages.length} messages
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Export conversation"
            onClick={exportTranscript}
          >
            <Download className="size-3" />
          </Button>
        </div>
      )}
      <div
        className={
          layout === 'workspace'
            ? 'mx-auto w-full max-w-3xl shrink-0 px-1 pb-3 sm:px-5 sm:pb-5'
            : 'shrink-0'
        }
      >
        <AgentComposer
          draft={draft}
          onDraft={setDraft}
          onSubmit={() => submit()}
          busy={busy}
          connected={chat.connected}
          onStop={() => void chat.stop()}
          config={chat.config}
          onConfigure={chat.configure}
          configSaving={chat.configSaving}
        />
      </div>
    </>
  )
}
