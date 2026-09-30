import { getToolName, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'

const operations = {
  create_shapes: { action: 'Create', completed: 'Created', result: 'created' },
  update_shapes: { action: 'Update', completed: 'Updated', result: 'updated' },
  delete_shapes: { action: 'Delete', completed: 'Deleted', result: 'deleted' },
} as const

const operationFor = (toolName: string) =>
  Object.hasOwn(operations, toolName)
    ? operations[toolName as keyof typeof operations]
    : undefined
const shapeCount = (count: number) =>
  `${count} ${count === 1 ? 'shape' : 'shapes'}`

export function summarizeTool(toolName: string, input: unknown) {
  const operation = operationFor(toolName)
  if (!operation || !input || typeof input !== 'object') return null
  const values = Object.values(input).find(Array.isArray)
  return `Requested: ${operation.action.toLowerCase()} ${shapeCount(values?.length ?? 0)}`
}

export function summarizeToolResult(
  toolName: string,
  output: unknown,
  failed = false,
) {
  const operation = operationFor(toolName)
  if (!operation) return null
  if (failed)
    return {
      summary: `${operation.action} shapes was declined or failed`,
      applied: 0,
    }
  if (!output || typeof output !== 'object') return null
  const result = Reflect.get(output, operation.result)
  if (!Array.isArray(result)) return null
  const errors = Reflect.get(output, 'errors')
  const errorCount = Array.isArray(errors) ? errors.length : 0
  return {
    summary: `${operation.completed} ${shapeCount(result.length)}${errorCount ? ` · ${errorCount} ${errorCount === 1 ? 'issue' : 'issues'}` : ''}`,
    applied: result.length,
  }
}

export function transcriptMetadata(messages: UIMessage[]) {
  const text = (message: UIMessage) =>
    message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim()
  const firstUser = messages.find((message) => message.role === 'user')
  const last = [...messages].reverse().find((message) => text(message))
  const changes = messages.flatMap((message) =>
    message.role === 'assistant'
      ? message.parts.flatMap((part) => {
          if (
            !isToolUIPart(part) ||
            (part.state !== 'output-available' &&
              part.state !== 'output-error' &&
              part.state !== 'output-denied')
          )
            return []
          const toolName = getToolName(part)
          const result = summarizeToolResult(
            toolName,
            part.state === 'output-available' ? part.output : null,
            part.state !== 'output-available',
          )
          return result
            ? [{ toolCallId: part.toolCallId, toolName, ...result }]
            : []
        })
      : [],
  )
  return {
    title: firstUser ? text(firstUser).slice(0, 80) : '',
    lastMessage: last ? text(last).slice(0, 240) : '',
    messageCount: messages.length,
    changes,
  }
}
