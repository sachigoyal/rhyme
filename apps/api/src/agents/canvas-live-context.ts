import type { UIMessage } from 'ai'
import type { CanvasContext } from './canvas-schema'

export type LiveCanvas = {
  userMessageId: string
  toolCallId: string
  canvas: CanvasContext
}

export function resolveCanvasSnapshot(
  messages: UIMessage[],
  initial: unknown,
  live?: LiveCanvas,
) {
  const userIndex = messages.map((message) => message.role).lastIndexOf('user')
  if (!live || messages[userIndex]?.id !== live.userMessageId) return initial
  const completed = messages
    .slice(userIndex + 1)
    .some(
      (message) =>
        message.role === 'assistant' &&
        message.parts.some(
          (part) =>
            'toolCallId' in part &&
            part.toolCallId === live.toolCallId &&
            'state' in part &&
            (part.state === 'output-available' ||
              part.state === 'output-error'),
        ),
    )
  return completed ? live.canvas : initial
}
