import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  PenLine,
  ScanSearch,
  Shapes,
  Trash2,
} from 'lucide-react'
import type { Editor } from 'tldraw'
import { Button } from '@rhyme/ui/components/button'
import { cn } from '@rhyme/ui/lib/utils'
import { Shimmer, StreamingCaret, ThinkingBlock } from './agent-activity'
import { toShapeId } from './canvas-context'

type Part = UIMessage['parts'][number]
type ToolPart = Extract<Part, { toolCallId: string }>

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
        text: done ? 'Looked at the canvas' : 'Looking at the canvas…',
      }
    case 'create_shapes': {
      const created = count(output?.created)
      const failed = count(output?.errors)
      return {
        icon: Shapes,
        text: done
          ? `Drew ${plural(created, 'shape')}${failed ? `, ${failed} failed` : ''}`
          : `Drawing ${plural(count(input.shapes), 'shape')}…`,
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
    <div
      className={cn(
        'text-muted-foreground flex items-start gap-2 text-xs',
        failed && 'text-destructive',
      )}
    >
      {running ? (
        <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" />
      ) : failed ? (
        <AlertTriangle className="mt-px size-3.5 shrink-0" />
      ) : (
        <Icon className="mt-px size-3.5 shrink-0" />
      )}
      <span className="min-w-0 break-words">
        {failed ? part.errorText : running ? <Shimmer>{text}</Shimmer> : text}
      </span>
    </div>
  )
}

function DeleteApproval({
  editor,
  input,
  onResolve,
}: {
  editor: Editor
  input: unknown
  onResolve: (approved: boolean) => void
}) {
  const ids = ((input as { ids?: string[] } | undefined)?.ids ?? [])
    .map(toShapeId)
    .filter((id) => editor.getShape(id))

  const show = () => {
    editor.select(...ids)
    editor.zoomToSelection({ animation: { duration: 200 } })
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
          <Button size="xs" variant="outline" onClick={() => onResolve(false)}>
            Keep
          </Button>
          <Button
            size="xs"
            variant="destructive"
            onClick={() => onResolve(true)}
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
  editor: Editor
  live: boolean
  onResolveDeletion: (
    toolCallId: string,
    input: unknown,
    approved: boolean,
  ) => void
}

export function AgentMessage({
  message,
  editor,
  live,
  onResolveDeletion,
}: AgentMessageProps) {
  if (message.role === 'user') {
    const text = message.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join('\n')
    return (
      <div className="bg-muted ml-8 self-end rounded-2xl rounded-br-md px-3 py-2 text-sm whitespace-pre-wrap">
        {text}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, index) => {
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
            <p
              key={index}
              className="text-sm leading-relaxed break-words whitespace-pre-wrap"
            >
              {part.text.trim()}
              {streaming && <StreamingCaret />}
            </p>
          ) : null
        }
        if (!isToolUIPart(part)) return null

        const name = getToolName(part)
        if (name === 'delete_shapes' && part.state === 'input-available') {
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
        return (
          <ToolRow key={part.toolCallId} name={name} part={part} live={live} />
        )
      })}
    </div>
  )
}
