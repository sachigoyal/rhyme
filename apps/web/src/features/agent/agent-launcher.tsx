import { Check, Loader2, X } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { cn } from '@rhyme/ui/lib/utils'

export type AgentStatus =
  'idle' | 'connecting' | 'thinking' | 'editing' | 'approval' | 'done' | 'error'

const labels = {
  idle: 'Ask Rhyme',
  connecting: 'Connecting',
  thinking: 'Thinking',
  editing: 'Drawing',
  approval: 'Needs approval',
  done: 'Reply ready',
  error: 'Needs attention',
} satisfies Record<AgentStatus, string>

export function AgentFace({
  status = 'idle',
  className,
}: {
  status?: AgentStatus
  className?: string
}) {
  const busy =
    status === 'thinking' || status === 'editing' || status === 'connecting'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex size-7 items-center justify-center rounded-lg border border-current/20',
        busy && 'motion-safe:animate-pulse',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5',
          status === 'done' && '-rotate-6',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1 rounded-full bg-current',
            status === 'editing' && 'h-1',
            status === 'error' && 'rotate-45',
          )}
        />
        <span
          className={cn(
            'h-1.5 w-1 rounded-full bg-current',
            status === 'editing' && 'h-1',
            status === 'error' && '-rotate-45',
          )}
        />
      </span>
    </span>
  )
}

export function AgentLauncher({
  status = 'idle',
  open,
  onClick,
}: {
  status?: AgentStatus
  open: boolean
  onClick: () => void
}) {
  const busy =
    status === 'thinking' || status === 'editing' || status === 'connecting'

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-label={
        open
          ? 'Close Rhyme assistant'
          : `Open Rhyme assistant: ${labels[status]}`
      }
      aria-expanded={open}
      className={cn(
        'bg-background flex h-12 gap-2.5 rounded-2xl border px-3 shadow-none',
        status === 'error' && 'border-destructive/40',
      )}
    >
      <AgentFace status={status} />
      <span className="text-xs font-medium">
        {open ? 'Assistant' : labels[status]}
      </span>
      {open ? (
        <X className="size-3.5 text-muted-foreground" />
      ) : busy ? (
        <Loader2 className="size-3 text-muted-foreground motion-safe:animate-spin" />
      ) : status === 'done' ? (
        <Check className="size-3.5" />
      ) : null}
    </Button>
  )
}
