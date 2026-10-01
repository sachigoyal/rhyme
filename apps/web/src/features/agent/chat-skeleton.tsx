import { useState } from 'react'
import { DEFAULT_AGENT_CONFIG } from 'api/agent-config'
import { AgentComposer } from './agent-composer'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { cn } from '@rhyme/ui/lib/utils'
import { chatComposerLayouts, chatMessageLayouts } from './chat-layout'
import type { ChatLayout } from './chat-layout'

export function MessagesSkeleton({
  layout = 'panel',
}: {
  layout?: ChatLayout
}) {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className={cn('flex flex-col', chatMessageLayouts[layout])}
    >
      <div aria-hidden="true" className="flex flex-col gap-5">
        <Skeleton className="h-10 w-3/4 max-w-sm self-end rounded-xl rounded-br-md" />
        <div className="space-y-2.5">
          <Skeleton className="mb-4 h-3 w-24" />
          <Skeleton className="h-3 w-5/6 max-w-lg" />
          <Skeleton className="h-3 w-3/4 max-w-md" />
          <Skeleton className="h-3 w-1/2 max-w-xs" />
        </div>
        <Skeleton className="h-9 w-1/2 max-w-48 self-end rounded-xl rounded-br-md" />
        <div className="space-y-2.5">
          <Skeleton className="h-3 w-4/5 max-w-lg" />
          <Skeleton className="h-3 w-2/3 max-w-sm" />
        </div>
      </div>
    </div>
  )
}

export function LoadingComposer({
  layout = 'panel',
  draft: controlledDraft,
  onDraft,
}: {
  layout?: ChatLayout
  draft?: string
  onDraft?: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <div className={chatComposerLayouts[layout]}>
      <AgentComposer
        draft={controlledDraft ?? draft}
        onDraft={onDraft ?? setDraft}
        onSubmit={() => {}}
        connected={false}
        config={DEFAULT_AGENT_CONFIG}
        onConfigure={async () => false}
      />
    </div>
  )
}

export function ChatSkeleton({
  layout = 'workspace',
  draft,
  onDraft,
}: {
  layout?: ChatLayout
  draft?: string
  onDraft?: (text: string) => void
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <MessagesSkeleton layout={layout} />
      </div>
      <LoadingComposer layout={layout} draft={draft} onDraft={onDraft} />
    </div>
  )
}
