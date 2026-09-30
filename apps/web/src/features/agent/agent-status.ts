import type { UIMessage } from 'ai'

export type AgentStatus =
  'idle' | 'connecting' | 'thinking' | 'editing' | 'approval' | 'done' | 'error'

export const agentStatusLabels = {
  idle: 'Ask Rhyme',
  connecting: 'Connecting',
  thinking: 'Thinking',
  editing: 'Using tools',
  approval: 'Needs approval',
  done: 'Reply ready',
  error: 'Needs attention',
} satisfies Record<AgentStatus, string>

export function resolveAgentStatus({
  messages,
  connected,
  busy,
  usingTools,
  error,
  completed,
}: {
  messages: UIMessage[]
  connected: boolean
  busy: boolean
  usingTools: boolean
  error: boolean
  completed: boolean
}): AgentStatus {
  if (error) return 'error'
  if (!connected) return 'connecting'
  if (
    messages.some((message) =>
      message.parts.some(
        (part) =>
          part.type === 'tool-delete_shapes' &&
          'state' in part &&
          part.state === 'input-available',
      ),
    )
  )
    return 'approval'
  if (usingTools) return 'editing'
  if (busy) {
    const toolsPending = messages
      .at(-1)
      ?.parts.some(
        (part) =>
          (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
          'state' in part &&
          (part.state === 'input-streaming' ||
            part.state === 'input-available'),
      )
    return toolsPending ? 'editing' : 'thinking'
  }
  return completed ? 'done' : 'idle'
}
