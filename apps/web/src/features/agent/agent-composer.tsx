import { useId, useLayoutEffect, useRef } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import type { AgentConfig } from 'api/agent-config'
import { Button } from '@rhyme/ui/components/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@rhyme/ui/components/input-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rhyme/ui/components/tooltip'
import { AgentModelSelector } from './agent-model-selector'

const SUGGESTIONS = [
  {
    label: 'Mind map',
    prompt:
      'Create a clear mind map for a new project idea. Start with goals, users, and next steps.',
  },
  {
    label: 'Flowchart',
    prompt: 'Sketch a simple sign-up flow as a diagram with connected steps.',
  },
  {
    label: 'Organize shapes',
    prompt:
      'Look at the canvas and organize its shapes into a clearer layout, preserving their content.',
  },
]

export function AgentEmptyState({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-full flex-col justify-center px-4 py-5">
      <h3 className="text-base font-medium tracking-tight">
        What shall we make?
      </h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-5">
        Turn an idea into a diagram, or reshape what’s here.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.label}
            variant="outline"
            size="sm"
            className="rounded-full font-normal shadow-none"
            disabled={disabled}
            onClick={() => onSubmit(suggestion.prompt)}
          >
            {suggestion.label}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground mt-4 text-[11px] leading-5">
        Works with your canvas and selection. Undo any change.
      </p>
    </div>
  )
}

export function AgentComposer({
  draft,
  onDraft,
  onSubmit,
  busy = false,
  connected = true,
  onStop,
  config,
  onConfigure,
  configSaving = false,
}: {
  draft: string
  onDraft: (text: string) => void
  onSubmit: () => void
  busy?: boolean
  connected?: boolean
  onStop?: () => void
  config: AgentConfig
  onConfigure: (config: AgentConfig) => Promise<boolean>
  configSaving?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hintId = useId()
  const canSend = Boolean(draft.trim()) && connected && !busy && !configSaving
  const actionDisabled = busy ? !onStop : !canSend
  const actionHint = busy
    ? onStop
      ? 'Stop response'
      : 'Response in progress'
    : configSaving
      ? 'Saving model settings'
      : !connected
        ? 'Waiting for connection'
        : !draft.trim()
          ? 'Write a message to send'
          : 'Send message · Enter'

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`
  }, [draft])

  return (
    <form
      className="shrink-0 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSubmit()
      }}
    >
      <InputGroup
        className="cursor-text rounded-xl bg-background p-2 transition-none focus-within:border-foreground/50 has-disabled:bg-background has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-foreground/50 has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-background dark:has-disabled:bg-background"
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.currentTarget.contains(event.target) &&
            !event.target.closest('button, [data-composer-action]')
          ) {
            textareaRef.current?.focus()
          }
        }}
      >
        <InputGroupTextarea
          ref={textareaRef}
          aria-label="Message Rhyme"
          aria-describedby={hintId}
          placeholder="Ask Rhyme…"
          value={draft}
          rows={1}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229 &&
              canSend
            ) {
              event.preventDefault()
              onSubmit()
            }
          }}
          className="native-scrollbar max-h-48 min-h-14 overflow-y-auto px-1 py-2 text-base leading-6 md:text-sm"
        />
        <InputGroupAddon
          align="block-end"
          className="justify-between gap-2 p-0 pt-1"
        >
          <span id={hintId} className="sr-only">
            Press Enter to send. Shift + Enter adds a new line. You can edit
            your draft while Rhyme is responding or reconnecting.
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <AgentModelSelector
              config={config}
              onSelect={onConfigure}
              disabled={busy || !connected || configSaving}
              saving={configSaving}
            />
            {(busy || !connected) && (
              <span
                role="status"
                className="text-muted-foreground truncate text-xs font-normal"
              >
                {busy ? 'Working…' : 'Connecting…'}
              </span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  data-composer-action=""
                  className="inline-flex shrink-0"
                  role={actionDisabled ? 'group' : undefined}
                  tabIndex={actionDisabled ? 0 : undefined}
                  aria-label={actionDisabled ? actionHint : undefined}
                >
                  <InputGroupButton
                    type={busy ? 'button' : 'submit'}
                    size="icon-sm"
                    variant={busy ? 'secondary' : 'default'}
                    aria-label={busy ? 'Stop response' : 'Send message'}
                    disabled={actionDisabled}
                    onClick={busy ? onStop : undefined}
                    className="rounded-lg"
                  >
                    {busy ? (
                      <Square className="size-3 fill-current" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </InputGroupButton>
                </span>
              }
            />
            <TooltipContent side="top" sideOffset={6}>
              {actionHint}
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
