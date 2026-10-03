import { useState } from 'react'
import { useAssistantPreferences } from './assistant-preferences'
import { AgentComposer } from './agent-composer'
import { cn } from '@rhyme/ui/lib/utils'
import { chatComposerLayouts, chatMessageLayouts } from './chat-layout'
import type { ChatLayout } from './chat-layout'

export function LoadingMessages({ layout = 'panel' }: { layout?: ChatLayout }) {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className={cn('flex flex-col', chatMessageLayouts[layout])}
    >
      <p className="text-muted-foreground text-xs">Loading messages…</p>
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
  const { config, configure } = useAssistantPreferences()
  return (
    <div className={chatComposerLayouts[layout]}>
      <AgentComposer
        draft={controlledDraft ?? draft}
        onDraft={onDraft ?? setDraft}
        onSubmit={() => {}}
        connected={false}
        config={config}
        onConfigure={configure}
      />
    </div>
  )
}

export function LoadingChat({
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
        <LoadingMessages layout={layout} />
      </div>
      <LoadingComposer layout={layout} draft={draft} onDraft={onDraft} />
    </div>
  )
}
