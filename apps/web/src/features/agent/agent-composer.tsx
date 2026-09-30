import { useId, useLayoutEffect, useRef } from 'react'
import { ArrowUp, Lightbulb, Square } from 'lucide-react'
import type { AgentConfig } from 'api/agent-config'
import { Button } from '@rhyme/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
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
import { AgentFace } from './agent-face'
import type { AgentStatus } from './agent-status'
import { AgentModelSelector } from './agent-model-selector'

const SUGGESTIONS = [
  {
    label: 'Create a mind map',
    prompt:
      'Create a clear mind map for a new project idea. Start with goals, users, and next steps.',
  },
  {
    label: 'Create a flowchart',
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
  status = 'idle',
}: {
  onSubmit: (text: string) => void
  disabled?: boolean
  status?: AgentStatus
}) {
  return (
    <div className="flex min-h-full flex-col justify-center px-5 py-8">
      <AgentFace status={status} className="mb-5 size-12" />
      <h3 className="text-lg font-medium tracking-tight">Canvas assistant</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        Create diagrams or edit shapes using a prompt.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.label}
            variant="outline"
            className="h-11 justify-between rounded-lg px-3 text-sm font-normal shadow-none"
            disabled={disabled}
            onClick={() => onSubmit(suggestion.prompt)}
          >
            {suggestion.label}
            <ArrowUp className="size-3 -rotate-45 text-muted-foreground" />
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground mt-6 text-[11px] leading-5">
        The assistant can read the canvas and your selection. Use Undo to revert
        its edits.
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
          aria-label="Message the assistant"
          aria-describedby={hintId}
          placeholder="Describe a change…"
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
          className="max-h-48 min-h-14 overflow-y-auto px-1 py-2 text-base leading-6 md:text-sm"
        />
        <InputGroupAddon
          align="block-end"
          className="justify-between gap-2 p-0 pt-1"
        >
          <span id={hintId} className="sr-only">
            Press Enter to send. Shift + Enter adds a new line. You can edit
            your draft while the assistant is responding or reconnecting.
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <AgentModelSelector
              config={config}
              onSelect={onConfigure}
              disabled={busy || !connected || configSaving}
              saving={configSaving}
            />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <InputGroupButton
                      size="icon-sm"
                      aria-label="Example prompts"
                      className="rounded-lg"
                    >
                      <Lightbulb className="size-4" />
                    </InputGroupButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Example prompts
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56 shadow-none"
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                  textareaRef.current?.focus()
                }}
              >
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  Choose a prompt to edit
                </DropdownMenuLabel>
                {SUGGESTIONS.map((suggestion) => (
                  <DropdownMenuItem
                    key={suggestion.label}
                    onSelect={() => onDraft(suggestion.prompt)}
                  >
                    {suggestion.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
            <TooltipTrigger asChild>
              <span
                data-composer-action=""
                className="inline-flex shrink-0"
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
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {actionHint}
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
