import type { Editor } from 'tldraw'
import { isCanvasMutation } from 'api/canvas-schema'
import { runCanvasTool } from './canvas-actions'

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

export function createCanvasToolRunner(editor: Editor) {
  const results = new Map<string, ToolResult>()
  const pending = new Map<
    string,
    Promise<{ result: ToolResult; applied: boolean }>
  >()
  let queue = Promise.resolve()
  let turnMarked = false
  return {
    beginTurn() {
      turnMarked = false
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
      const task = queue.then(async () => {
        try {
          if (isCanvasMutation(name) && !turnMarked) {
            editor.markHistoryStoppingPoint('agent turn')
            turnMarked = true
          }
          const result: ToolResult = {
            state: 'output-available',
            output: await runCanvasTool(editor, name, input),
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
        }
      })
      pending.set(toolCallId, task)
      queue = task.then(() => {})
      try {
        return await task
      } finally {
        pending.delete(toolCallId)
      }
    },
  }
}
