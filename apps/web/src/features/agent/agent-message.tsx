import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Loader2,
  PenLine,
  Pencil,
  RotateCcw,
  ScanSearch,
  Shapes,
  Trash2,
} from 'lucide-react'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import { Button } from '@rhyme/ui/components/button'
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@rhyme/ui/components/message'
import { Marker, MarkerContent, MarkerIcon } from '@rhyme/ui/components/marker'
import { Textarea } from '@rhyme/ui/components/textarea'
import { cn } from '@rhyme/ui/lib/utils'
import { Shimmer, StreamingCaret, ThinkingBlock } from './agent-activity'
import { toShapeId } from './canvas-context'

type Part = UIMessage['parts'][number]
type ToolPart = Extract<Part, { toolCallId: string }>

function MessageActivity({
  parts,
  live,
  children,
}: {
  parts: Array<Part>
  live: boolean
  children: React.ReactNode
}) {
  if (!parts.length) return null
  if (live) return <div className="space-y-2">{children}</div>

  const failed = parts.filter(
    (part) => isToolUIPart(part) && part.state === 'output-error',
  ).length

  return (
    <details className="group/activity text-xs">
      <summary
        className={cn(
          'text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1.5 transition-colors [&::-webkit-details-marker]:hidden',
          failed && 'text-destructive',
        )}
      >
        {failed ? (
          <AlertTriangle className="size-3.5" />
        ) : (
          <Check className="size-3.5" />
        )}
        {failed
          ? `Activity · ${plural(failed, 'action')} failed`
          : `Activity · ${plural(parts.length, 'step')}`}
        <ChevronRight className="size-2.5 transition-transform group-open/activity:rotate-90" />
      </summary>
      <div className="mt-2 space-y-2 border-l pl-3">{children}</div>
    </details>
  )
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

const count = (value: unknown) => (Array.isArray(value) ? value.length : 0)

function describeTool(name: string, part: ToolPart) {
  const input = (part.input ?? {}) as Record<string, unknown>
  const output = (part.state === 'output-available' ? part.output : {}) as
    Record<string, unknown> | undefined
  const done = part.state === 'output-available'

  switch (name) {
    case 'read_canvas':
      return {
        icon: ScanSearch,
        text: done ? 'Read canvas' : 'Reading canvas…',
      }
    case 'create_shapes': {
      const created = count(output?.created)
      const failed = count(output?.errors)
      return {
        icon: Shapes,
        text: done
          ? `Created ${plural(created, 'shape')}${failed ? `, ${failed} failed` : ''}`
          : `Creating ${plural(count(input.shapes), 'shape')}…`,
      }
    }
    case 'update_shapes':
      return {
        icon: PenLine,
        text: done
          ? `Updated ${plural(count(output?.updated), 'shape')}`
          : `Updating ${plural(count(input.updates), 'shape')}…`,
      }
    case 'delete_shapes':
      return {
        icon: Trash2,
        text: done
          ? `Deleted ${plural(count(output?.deleted), 'shape')}`
          : `Deleting ${plural(count(input.ids), 'shape')}…`,
      }
    default:
      return { icon: Shapes, text: name }
  }
}

function ToolRow({
  name,
  part,
  live,
}: {
  name: string
  part: ToolPart
  live: boolean
}) {
  const { icon: Icon, text } = describeTool(name, part)
  const failed = part.state === 'output-error'
  const running = live && !failed && part.state !== 'output-available'

  return (
    <Marker
      className={cn(
        'text-muted-foreground flex items-start gap-2 text-xs',
        failed && 'text-destructive',
      )}
    >
      <MarkerIcon className="size-3.5">
        {running ? (
          <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" />
        ) : failed ? (
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
        ) : (
          <Icon className="mt-px size-3.5 shrink-0" />
        )}
      </MarkerIcon>
      <MarkerContent className="min-w-0 break-words">
        {failed ? (
          part.errorText
        ) : running ? (
          <Shimmer>{text}</Shimmer>
        ) : part.state !== 'output-available' ? (
          name === 'delete_shapes' ? (
            'Deletion awaiting approval'
          ) : (
            'Canvas action interrupted'
          )
        ) : (
          text
        )}
      </MarkerContent>
    </Marker>
  )
}

function DeleteApproval({
  editor,
  input,
  onResolve,
}: {
  editor: Editor
  input: unknown
  onResolve: (approved: boolean) => Promise<void>
}) {
  const [resolving, setResolving] = useState(false)
  const ids = ((input as { ids?: string[] } | undefined)?.ids ?? [])
    .map(toShapeId)
    .filter((id) => editor.getShape(id))

  const show = () => {
    editor.select(...ids)
    editor.zoomToSelection({ animation: { duration: 200 } })
  }

  const resolve = async (approved: boolean) => {
    if (resolving) return
    setResolving(true)
    try {
      await onResolve(approved)
    } catch (error) {
      setResolving(false)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not confirm this canvas action',
      )
    }
  }

  return (
    <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Trash2 className="size-4" />
        Delete {plural(ids.length, 'shape')}?
      </p>
      <div className="flex gap-2">
        <Button size="xs" variant="ghost" onClick={show} disabled={!ids.length}>
          <Eye />
          Show
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={resolving}
            onClick={() => void resolve(false)}
          >
            Keep
          </Button>
          <Button
            size="xs"
            variant="destructive"
            disabled={resolving}
            onClick={() => void resolve(true)}
          >
            <Check />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

interface AgentMessageProps {
  message: UIMessage
  editor?: Editor
  live?: boolean
  onRegenerate?: (messageId: string) => void
  onEdit?: (messageId: string, text: string) => void
  onResolveDeletion?: (
    toolCallId: string,
    input: unknown,
    approved: boolean,
  ) => Promise<void>
}

export function AgentMessage({
  message,
  editor,
  live = false,
  onRegenerate,
  onEdit,
  onResolveDeletion,
}: AgentMessageProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [editing, setEditing] = useState(false)
  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('\n')
  const [draft, setDraft] = useState(text)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setCopyError(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
    }
  }

  if (message.role === 'user') {
    return (
      <Message align="end">
        <MessageContent
          className={cn('max-w-[90%] gap-1', editing ? 'w-full' : 'w-fit')}
        >
          {editing ? (
            <form
              className="w-full rounded-xl border p-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (draft.trim()) {
                  onEdit?.(message.id, draft.trim())
                  setEditing(false)
                }
              }}
            >
              <Textarea
                autoFocus
                aria-label="Edit message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-20 border-0 shadow-none focus-visible:ring-0"
              />
              <div className="mt-2 flex justify-end gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="xs" disabled={!draft.trim()}>
                  Send again
                </Button>
              </div>
            </form>
          ) : (
            <div className="bg-muted w-fit max-w-full rounded-xl rounded-br-md px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
              {text}
            </div>
          )}
          {onEdit && !live && !editing && (
            <MessageFooter className="gap-0 px-0 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit message"
                onClick={() => {
                  setDraft(text)
                  setEditing(true)
                }}
              >
                <Pencil className="size-3" />
              </Button>
            </MessageFooter>
          )}
        </MessageContent>
      </Message>
    )
  }

  const needsApproval = (part: Part) =>
    isToolUIPart(part) &&
    getToolName(part) === 'delete_shapes' &&
    part.state === 'input-available' &&
    Boolean(editor && onResolveDeletion)
  const activity = message.parts.filter(
    (part) =>
      (isReasoningUIPart(part) || isToolUIPart(part)) && !needsApproval(part),
  )
  const renderPart = (part: Part, index: number) => {
    if (isReasoningUIPart(part)) {
      return (
        <ThinkingBlock
          key={index}
          text={part.text}
          streaming={live && part.state === 'streaming'}
        />
      )
    }
    if (isTextUIPart(part)) {
      const streaming = live && part.state === 'streaming'
      return part.text.trim() || streaming ? (
        <div
          key={index}
          className="text-sm leading-7 break-words [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.8em] [&_h1]:mb-2 [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:font-medium [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:pl-5"
        >
          <ReactMarkdown
            components={{
              a: ({ children, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {part.text.trim()}
          </ReactMarkdown>
          {streaming && <StreamingCaret />}
        </div>
      ) : null
    }
    if (!isToolUIPart(part)) return null

    const name = getToolName(part)
    if (
      name === 'delete_shapes' &&
      part.state === 'input-available' &&
      editor &&
      onResolveDeletion
    ) {
      return (
        <DeleteApproval
          key={part.toolCallId}
          editor={editor}
          input={part.input}
          onResolve={(approved) =>
            onResolveDeletion(part.toolCallId, part.input, approved)
          }
        />
      )
    }
    return <ToolRow key={part.toolCallId} name={name} part={part} live={live} />
  }

  return (
    <Message>
      <MessageContent className="gap-2">
        <MessageActivity parts={activity} live={live}>
          {activity.map(renderPart)}
        </MessageActivity>
        {message.parts
          .filter((part) => isTextUIPart(part) || needsApproval(part))
          .map(renderPart)}
        {!live && text.trim() && (
          <MessageFooter className="gap-0 px-0">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={copied ? 'Copied response' : 'Copy response'}
              onClick={() => void copy()}
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Regenerate response"
                onClick={() => onRegenerate(message.id)}
              >
                <RotateCcw className="size-3" />
              </Button>
            )}
            {copyError && (
              <span className="ml-1 text-xs text-destructive" role="status">
                Couldn’t copy. Select the text to copy it.
              </span>
            )}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  )
}
