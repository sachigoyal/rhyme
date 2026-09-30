import { Button } from '@rhyme/ui/components/button'
import { cn } from '@rhyme/ui/lib/utils'
import { AgentFace } from './agent-face'
import { agentStatusLabels } from './agent-status'
import type { AgentStatus } from './agent-status'

export function AgentLauncher({
  status = 'idle',
  open,
  onClick,
}: {
  status?: AgentStatus
  open: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={
        open
          ? 'Close Rhyme assistant'
          : `Open Rhyme assistant: ${agentStatusLabels[status]}`
      }
      aria-expanded={open}
      className={cn(
        'group/assistant relative size-14 rounded-full bg-background p-0 shadow-none hover:bg-background focus-visible:ring-primary/35',
      )}
    >
      <AgentFace status={status} className="size-14" />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute right-full mr-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-opacity motion-reduce:transition-none',
          status === 'idle'
            ? 'opacity-0 group-hover/assistant:opacity-100 group-focus-visible/assistant:opacity-100'
            : 'opacity-100',
        )}
      >
        {open ? 'Close assistant' : agentStatusLabels[status]}
      </span>
    </Button>
  )
}
