import { useSyncExternalStore } from 'react'
import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rhyme/ui/components/tooltip'
import type { DocumentSync, SyncStatus } from './document-sync'

const labels: Record<
  Exclude<SyncStatus, 'conflict'>,
  { text: string; hint: string }
> = {
  saved: { text: 'Saved', hint: 'All changes are saved to your account.' },
  unsaved: {
    text: 'Unsaved',
    hint: 'Changes are waiting to sync.',
  },
  saving: { text: 'Saving…', hint: 'Saving changes to your account.' },
  offline: {
    text: 'Offline',
    hint: 'Changes will sync when you reconnect.',
  },
  error: {
    text: 'Retrying',
    hint: 'Couldn’t sync changes. Retrying automatically.',
  },
}

export function useSyncStatus(sync: DocumentSync) {
  return useSyncExternalStore(sync.subscribe, sync.getStatus, sync.getStatus)
}

export function SaveStatus({
  sync,
  onResolve,
}: {
  sync: DocumentSync
  onResolve: () => void
}) {
  const status = useSyncStatus(sync)

  if (status === 'conflict') {
    return (
      <Button size="sm" variant="destructive" onClick={onResolve}>
        <AlertTriangle />
        Resolve conflict
      </Button>
    )
  }

  const { text, hint } = labels[status]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="status"
          aria-live="polite"
          className="text-muted-foreground flex items-center gap-1.5 rounded-sm px-1 text-xs select-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          <StatusIcon status={status} />
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

function StatusIcon({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'saving':
      return <Loader2 className="size-3.5 animate-spin" />
    case 'offline':
      return <CloudOff className="size-3.5" />
    case 'error':
      return <AlertTriangle className="size-3.5 text-amber-500" />
    case 'unsaved':
      return <span className="size-1.5 rounded-full bg-amber-500" />
    default:
      return <Check className="size-3.5" />
  }
}
