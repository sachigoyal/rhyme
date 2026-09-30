import { useEffect, useState } from 'react'
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { Brain, ChevronRight, Sparkles } from 'lucide-react'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { cn } from '@rhyme/ui/lib/utils'

export function Shimmer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn('text-shimmer', className)}>{children}</span>
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

// Reasoning mounts while it streams, so the elapsed time is only meaningful for live turns.
export function ThinkingBlock({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  const [wasLive] = useState(streaming)
  const [open, setOpen] = useState<boolean | null>(null)
  const seconds = useElapsedSeconds(streaming)
  const expanded = open ?? streaming
  const body = text.trim()

  const label = streaming
    ? 'Thinking'
    : wasLive && seconds > 0
      ? `Thought for ${seconds}s`
      : 'Thought'

  return (
    <div className="text-xs">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors disabled:pointer-events-none"
        aria-expanded={expanded}
        disabled={!body}
        onClick={() => setOpen(!expanded)}
      >
        <Brain className="size-3.5" />
        {streaming ? <Shimmer>{label}</Shimmer> : label}
        {streaming && seconds > 0 && (
          <span className="tabular-nums opacity-60">{seconds}s</span>
        )}
        {body && (
          <ChevronRight
            className={cn(
              'size-3 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        )}
      </button>
      {expanded && body && (
        <div
          className={cn(
            'text-muted-foreground mt-1.5 ml-1.5 border-l pl-3 leading-relaxed whitespace-pre-wrap',
            // While streaming, show a short live tail anchored to the newest line.
            streaming &&
              'flex max-h-24 flex-col-reverse overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_40%)]',
          )}
        >
          <p>{body}</p>
        </div>
      )}
    </div>
  )
}

type Part = UIMessage['parts'][number]

const lastVisiblePart = (message: UIMessage) =>
  [...message.parts].reverse().find((part) => part.type !== 'step-start')

// What to show below the transcript when nothing on screen is visibly streaming.
export function pendingActivity(messages: UIMessage[], busy: boolean) {
  if (!busy) return null
  const last = messages.at(-1)
  if (!last || last.role === 'user') return 'Thinking'

  const part: Part | undefined = lastVisiblePart(last)
  if (!part) return 'Thinking'
  if (isToolUIPart(part)) {
    if (part.state === 'output-available') return 'Looking at the result'
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
    <div
      role="status"
      className="text-muted-foreground flex items-center gap-2 text-xs"
    >
      <Sparkles className="size-3.5 animate-pulse" />
      <Shimmer>{label}</Shimmer>
      {seconds >= 3 && (
        <span className="tabular-nums opacity-60">{seconds}s</span>
      )}
    </div>
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

export function MessagesSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-label="Loading conversation">
      <Skeleton className="h-9 w-2/3 self-end rounded-2xl rounded-br-md" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <Skeleton className="h-9 w-1/2 self-end rounded-2xl rounded-br-md" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  )
}
