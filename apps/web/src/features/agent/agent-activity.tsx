import { useEffect, useState } from 'react'
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { Brain, ChevronRight, Sparkles } from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@rhyme/ui/components/marker'
import { cn } from '@rhyme/ui/lib/utils'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@rhyme/ui/components/message-scroller'

export function Shimmer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('motion-safe:animate-pulse', className)}>
      {children}
    </span>
  )
}

function useElapsedSeconds(running: boolean) {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!running) setNow(Date.now())
  }, [running])

  return Math.max(0, Math.round((now - start) / 1000))
}

export function ThinkingBlock({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  const [wasLive] = useState(streaming)
  const [open, setOpen] = useState(false)
  const seconds = useElapsedSeconds(streaming)
  const body = text.trim()

  const label = streaming
    ? 'Thinking'
    : wasLive && seconds > 0
      ? `Reasoning · ${seconds}s`
      : 'Reasoning'

  return (
    <div className="text-xs">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors disabled:pointer-events-none"
        aria-expanded={open}
        disabled={!body}
        onClick={() => setOpen(!open)}
      >
        <Brain className="size-3.5" />
        {streaming ? <Shimmer>{label}</Shimmer> : label}
        {streaming && seconds > 0 && (
          <span className="tabular-nums opacity-60">{seconds}s</span>
        )}
        {body && (
          <ChevronRight
            className={cn('size-2.5 transition-transform', open && 'rotate-90')}
          />
        )}
      </button>
      {open && body && (
        <MessageScrollerProvider autoScroll={streaming}>
          <MessageScroller className="mt-1.5 ml-1.5 h-auto max-h-48 border-l pl-3">
            <MessageScrollerViewport
              aria-label="Reasoning"
              className="h-auto max-h-48"
            >
              <MessageScrollerContent className="min-h-0 gap-0 text-muted-foreground leading-relaxed whitespace-pre-wrap">
                <p>{body}</p>
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton
              aria-label="Scroll to latest reasoning"
              size="icon-xs"
              className="bottom-1"
            />
          </MessageScroller>
        </MessageScrollerProvider>
      )}
    </div>
  )
}

type Part = UIMessage['parts'][number]

const lastVisiblePart = (message: UIMessage) =>
  [...message.parts].reverse().find((part) => part.type !== 'step-start')

export function pendingActivity(messages: UIMessage[], busy: boolean) {
  if (!busy) return null
  const last = messages.at(-1)
  if (!last || last.role === 'user') return 'Thinking'

  const part: Part | undefined = lastVisiblePart(last)
  if (!part) return 'Thinking'
  if (isToolUIPart(part)) {
    if (part.state === 'output-available') return 'Reviewing result'
    if (part.state === 'output-error') return 'Recovering'
    return null
  }
  if (isReasoningUIPart(part) || isTextUIPart(part)) {
    return part.state === 'streaming' ? null : 'Thinking'
  }
  return null
}

export function ActivityIndicator({ label }: { label: string }) {
  const seconds = useElapsedSeconds(true)
  return (
    <Marker
      role="status"
      className="text-muted-foreground flex items-center gap-2 text-xs"
    >
      <MarkerIcon>
        <Sparkles className="size-3.5 animate-pulse" />
      </MarkerIcon>
      <MarkerContent>
        <Shimmer>{label}</Shimmer>
      </MarkerContent>
      {seconds >= 3 && (
        <span className="tabular-nums opacity-60">{seconds}s</span>
      )}
    </Marker>
  )
}

export function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="bg-foreground/60 ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-[2px]"
    />
  )
}
