import type { Editor } from 'tldraw'
import { runCanvasTool } from './canvas-actions'

type ToolResult =
  | { state: 'output-available'; output: ReturnType<typeof runCanvasTool> }
  | { state: 'output-error'; errorText: string }

export function createCanvasToolRunner(editor: Editor) {
  const results = new Map<string, ToolResult>()
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
    run(toolCallId: string, name: string, input: unknown) {
      const previous = results.get(toolCallId)
      if (previous) return { result: previous, applied: false }

      try {
        if (name !== 'read_canvas' && !turnMarked) {
          editor.markHistoryStoppingPoint('agent turn')
          turnMarked = true
        }
        const result: ToolResult = {
          state: 'output-available',
          output: runCanvasTool(editor, name, input),
        }
        results.set(toolCallId, result)
        return { result, applied: name !== 'read_canvas' }
      } catch (error) {
        const result: ToolResult = {
          state: 'output-error',
          errorText: error instanceof Error ? error.message : String(error),
        }
        results.set(toolCallId, result)
        return { result, applied: false }
      }
    },
  }
}
