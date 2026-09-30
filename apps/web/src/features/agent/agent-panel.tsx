import { Suspense, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUp,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import type { Editor } from 'tldraw'
import { Button } from '@rhyme/ui/components/button'
import { Textarea } from '@rhyme/ui/components/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rhyme/ui/components/tooltip'
import {
  ActivityIndicator,
  MessagesSkeleton,
  pendingActivity,
} from './agent-activity'
import { AgentMessage } from './agent-message'
import { useCanvasAgent } from './use-canvas-agent'

const SUGGESTIONS = [
  'Sketch a sign-up flow as a diagram',
  'Turn the selected notes into a mind map',
  'Add sticky notes brainstorming names for this project',
]

interface AgentPanelProps {
  fileId: string
  editor: Editor
  onClose: () => void
  onBusyChange?: (busy: boolean) => void
}

function PanelHeader({
  status,
  onClose,
  children,
}: {
  status?: React.ReactNode
  onClose: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <Sparkles className="text-muted-foreground size-4" />
      <h2 className="text-sm font-medium">Assistant</h2>
      {status}
      <div className="ml-auto flex items-center">
        {children}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

function ConnectionStatus({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span
        className={
          warn
            ? 'size-1.5 rounded-full bg-amber-500'
            : 'size-1.5 animate-pulse rounded-full bg-current'
        }
      />
      {label}
    </span>
  )
}

// useAgentChat suspends while it loads history; without this boundary the whole editor would suspend.
export function AgentPanel(props: AgentPanelProps) {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex h-full flex-col">
          <PanelHeader
            status={<ConnectionStatus label="Loading…" />}
            onClose={props.onClose}
          />
          <MessagesSkeleton />
        </div>
      }
    >
      <AgentChat {...props} />
    </Suspense>
  )
}

function AgentChat({ fileId, editor, onClose, onBusyChange }: AgentPanelProps) {
  const chat = useCanvasAgent(fileId, editor)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const busy =
    chat.status === 'submitted' ||
    chat.status === 'streaming' ||
    chat.isServerStreaming
  const lastMessageId = chat.messages.at(-1)?.id
  const activity = pendingActivity(chat.messages, busy)

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])

  useEffect(() => {
    const element = scrollRef.current
    element?.scrollTo({ top: element.scrollHeight })
  }, [chat.messages, activity])

  const submit = (text = draft) => {
    const message = text.trim()
    if (!message || busy || !chat.connected) return
    chat.send(message)
    setDraft('')
  }

  return (
    <div className="bg-background flex h-full flex-col">
      <PanelHeader
        onClose={onClose}
        status={
          chat.connectionError ? (
            <ConnectionStatus label="Reconnecting…" warn />
          ) : !chat.connected ? (
            <ConnectionStatus label="Connecting…" />
          ) : null
        }
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Clear conversation"
              disabled={!chat.messages.length || busy}
              onClick={chat.clearHistory}
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear conversation</TooltipContent>
        </Tooltip>
      </PanelHeader>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {chat.messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-3 p-4">
            <p className="text-muted-foreground text-sm">
              Ask the assistant to draw, rearrange or explain what’s on the
              canvas. It sees what’s on screen and your selection, and a single
              undo reverts everything from one reply.
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  size="sm"
                  variant="outline"
                  className="h-auto py-1.5 text-left whitespace-normal"
                  disabled={!chat.connected}
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {chat.messages.map((message) => (
              <AgentMessage
                key={message.id}
                message={message}
                editor={editor}
                live={busy && message.id === lastMessageId}
                onResolveDeletion={chat.resolveDeletion}
              />
            ))}
            {activity && <ActivityIndicator key={activity} label={activity} />}
            {chat.error && !busy && (
              <div className="text-destructive flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                <span className="flex-1">
                  Something went wrong while answering.
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void chat.regenerate()}
                >
                  <RotateCcw />
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="shrink-0 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 relative rounded-lg border focus-within:ring-3">
          <Textarea
            aria-label="Message the assistant"
            placeholder={
              chat.connected ? 'Ask about or edit the canvas…' : 'Connecting…'
            }
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                submit()
              }
            }}
            className="max-h-48 min-h-10 resize-none border-0 bg-transparent pr-11 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {busy ? (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label="Stop"
              className="absolute right-1.5 bottom-1.5"
              onClick={() => void chat.stop()}
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Send"
              className="absolute right-1.5 bottom-1.5"
              disabled={!draft.trim() || !chat.connected}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
