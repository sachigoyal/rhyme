import type { Editor } from 'tldraw'
import { isCanvasMutation } from 'api/canvas-schema'
import { runCanvasTool } from './canvas-actions'
import { beginEditorBatch } from '../editor/editor-batch'
import { createCanvasStreamExecutor } from './canvas-stream-executor'

type ToolResult =
  | {
      state: 'output-available'
      output: Awaited<ReturnType<typeof runCanvasTool>>
    }
  | { state: 'output-error'; errorText: string }

export const continuingToolResult = (result: ToolResult) =>
  result.state === 'output-error'
    ? {
        state: 'output-available' as const,
        output: { ok: false, error: result.errorText },
      }
    : result

export function createCanvasToolRunner(
  editor: Editor,
  waitForStep = async (_count: number) => {},
) {
  const results = new Map<string, ToolResult>()
  const pending = new Map<
    string,
    Promise<{ result: ToolResult; applied: boolean }>
  >()
  let queue = Promise.resolve()
  let turnMarked = false
  const controllers = new Set<AbortController>()
  const markTurn = () => {
    if (turnMarked) return
    editor.markHistoryStoppingPoint('agent turn')
    turnMarked = true
  }
  const stream = createCanvasStreamExecutor(
    editor,
    (action) => {
      queue = queue
        .then(action)
        .catch((error) => console.warn('Streamed canvas action failed', error))
    },
    markTurn,
  )
  const cancelledRequests = new Set<string>()
  const activeRequests = new Set<string>()
  return {
    beginTurn() {
      turnMarked = false
    },
    cancel() {
      for (const request of activeRequests) cancelledRequests.add(request)
      stream.cancel()
      for (const controller of controllers) controller.abort()
    },
    receive(data: unknown) {
      if (typeof data !== 'string') return
      try {
        const frame = JSON.parse(data)
        if (
          frame.type !== 'cf_agent_use_chat_response' ||
          cancelledRequests.has(frame.id) ||
          typeof frame.body !== 'string'
        )
          return
        activeRequests.add(frame.id)
        if (frame.error) {
          stream.cancel()
          activeRequests.delete(frame.id)
          return
        }
        if (frame.done) {
          activeRequests.delete(frame.id)
        }
        if (!frame.body.trim()) {
          if (frame.done) stream.interrupt()
          return
        }
        const chunk = JSON.parse(frame.body)
        if (chunk.type === 'tool-input-available')
          stream.ready(chunk.toolCallId)
        if (chunk.type === 'tool-input-error')
          stream.interrupt(chunk.toolCallId)
        if (chunk.type === 'tool-input-start' && !results.has(chunk.toolCallId))
          stream.start(chunk.toolCallId, chunk.toolName)
        if (
          chunk.type === 'tool-input-delta' &&
          typeof chunk.inputTextDelta === 'string'
        )
          stream.append(chunk.toolCallId, chunk.inputTextDelta)
        if (frame.done) stream.interrupt()
      } catch {
        // Other agent messages are not tool argument chunks.
      }
    },
    reject(toolCallId: string, errorText: string) {
      const previous = results.get(toolCallId)
      if (previous) return previous
      const result: ToolResult = { state: 'output-error', errorText }
      results.set(toolCallId, result)
      return result
    },
    async run(toolCallId: string, name: string, input: unknown) {
      const previous = results.get(toolCallId)
      if (previous) return { result: previous, applied: false }
      const running = pending.get(toolCallId)
      if (running) return { ...(await running), applied: false }
      const controller = new AbortController()
      controllers.add(controller)
      const task = queue.then(async () => {
        const release = isCanvasMutation(name)
          ? beginEditorBatch(editor)
          : () => {}
        try {
          controller.signal.throwIfAborted()
          if (isCanvasMutation(name) && !turnMarked) {
            markTurn()
          }
          const result: ToolResult = {
            state: 'output-available',
            output:
              (await stream.finish(toolCallId, name, input)) ??
              (await runCanvasTool(editor, name, input, async (count) => {
                await waitForStep(count)
                controller.signal.throwIfAborted()
              })),
          }
          results.set(toolCallId, result)
          return { result, applied: isCanvasMutation(name) }
        } catch (error) {
          const result: ToolResult = {
            state: 'output-error',
            errorText: error instanceof Error ? error.message : String(error),
          }
          results.set(toolCallId, result)
          return { result, applied: false }
        } finally {
          release()
        }
      })
      pending.set(toolCallId, task)
      queue = task.then(() => {})
      try {
        return await task
      } finally {
        pending.delete(toolCallId)
        controllers.delete(controller)
      }
    },
  }
}
