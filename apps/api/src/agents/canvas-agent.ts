import { AIChatAgent } from '@cloudflare/ai-chat'
import type { OnChatMessageOptions } from '@cloudflare/ai-chat'
import {
  convertToModelMessages,
  isStepCount,
  pruneMessages,
  streamText,
} from 'ai'
import type { ModelMessage } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import type { Env } from '../env'
import { canvasContext } from './canvas-schema'
import type { CanvasContext } from './canvas-schema'
import { canvasTools } from './canvas-tools'

const SYSTEM_PROMPT = `You are Rhyme's canvas assistant. You work inside a tldraw whiteboard next to the user and can read and edit it with tools.

Coordinates are tldraw page coordinates: x grows to the right, y grows downward, units are roughly screen pixels at 100% zoom. Every shape has page bounds {x, y, w, h} where (x, y) is its top-left corner.

With each user message you receive the canvas as it was when they sent it: the visible viewport bounds, the selected shape ids, the shapes on screen, and a screenshot of the viewport. When the user says "this" or "these", they usually mean the selection.

Drawing guidelines:
- Place new content inside the viewport, in empty space, unless asked otherwise. Leave at least 40 units between shapes.
- Size geo shapes to fit their label: about 9 units of width per character at the default size, 60–80 units tall for one line, plus padding.
- Notes are fixed 200×200 squares; text shapes auto-size unless you give them a width.
- Connect shapes with arrows by id instead of free points, so arrows stay attached when shapes move.
- Give shapes short ids you choose (e.g. "login", "db") when later shapes or later turns will refer to them.
- Build diagrams in one create_shapes call where possible; use read_canvas afterwards if you need to check the result.
- Only delete shapes when the user asks for it.

Keep replies short and in plain text, without markdown. After editing, say in a sentence what you changed. Don't describe coordinates unless asked.`

function withCanvas(messages: ModelMessage[], canvas: CanvasContext) {
  const index = messages.map((message) => message.role).lastIndexOf('user')
  const target = messages[index]
  if (!target || target.role !== 'user') return messages

  const { screenshot, ...state } = canvas
  const content =
    typeof target.content === 'string'
      ? [{ type: 'text' as const, text: target.content }]
      : target.content
  const [, mediaType, data] =
    screenshot?.match(/^data:(image\/\w+);base64,(.+)$/) ?? []

  const next = [...messages]
  next[index] = {
    ...target,
    content: [
      ...content,
      {
        type: 'text',
        text: `<canvas>\n${JSON.stringify(state)}\n</canvas>`,
      },
      ...(data && mediaType
        ? [{ type: 'image' as const, image: data, mediaType }]
        : []),
    ],
  }
  return next
}

// One instance per file and user: `${fileId}:${userId}`. History lives in the object's SQLite.
export class CanvasAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 200

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersAI = createWorkersAI({
      binding: this.env.AI as unknown as globalThis.Ai,
    })
    const canvas = canvasContext.safeParse(options?.body?.canvas)

    const messages = pruneMessages({
      messages: await convertToModelMessages(this.messages, {
        ignoreIncompleteToolCalls: true,
      }),
      reasoning: 'before-last-message',
      toolCalls: 'before-last-6-messages',
      emptyMessages: 'remove',
    })

    const result = streamText({
      model: workersAI(this.env.AI_MODEL),
      system: SYSTEM_PROMPT,
      messages: canvas.success ? withCanvas(messages, canvas.data) : messages,
      tools: canvasTools,
      stopWhen: isStepCount(8),
      abortSignal: options?.abortSignal,
    })

    return result.toUIMessageStreamResponse()
  }
}
