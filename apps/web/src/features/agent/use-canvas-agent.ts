import { useRef } from 'react'
import { useAgentChat } from '@cloudflare/ai-chat/react'
import { useAgent } from 'agents/react'
import type { Editor } from 'tldraw'
import { env } from '@/lib/env'
import { deleteShapes, parseToolInput, runCanvasTool } from './canvas-actions'
import { buildCanvasContext } from './canvas-context'

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export function useCanvasAgent(fileId: string, editor: Editor) {
  const turnMarked = useRef(false)

  const agent = useAgent({
    agent: 'CanvasAgent',
    basePath: `files/${fileId}/agent/chat`,
    host: env.apiUrl,
    protocol: env.apiUrl.startsWith('https:') ? 'wss' : 'ws',
  })

  // One stopping point per turn, so a single undo reverts everything the agent drew.
  const markTurn = () => {
    if (turnMarked.current) return
    editor.markHistoryStoppingPoint('agent turn')
    turnMarked.current = true
  }

  const chat = useAgentChat({
    agent,
    credentials: 'include',
    body: async () => ({ canvas: await buildCanvasContext(editor) }),
    onToolCall: ({ toolCall, addToolOutput }) => {
      if (toolCall.toolName === 'delete_shapes') return
      try {
        if (toolCall.toolName !== 'read_canvas') markTurn()
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: runCanvasTool(editor, toolCall.toolName, toolCall.input),
        })
      } catch (error) {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: errorText(error),
        })
      }
    },
  })

  const send = (text: string) => {
    turnMarked.current = false
    void chat.sendMessage({ text })
  }

  const resolveDeletion = (
    toolCallId: string,
    input: unknown,
    approved: boolean,
  ) => {
    if (!approved) {
      chat.addToolOutput({
        toolCallId,
        state: 'output-error',
        errorText: 'The user declined this deletion.',
      })
      return
    }
    try {
      markTurn()
      const output = deleteShapes(
        editor,
        parseToolInput('delete_shapes', input),
      )
      chat.addToolOutput({ toolCallId, output })
    } catch (error) {
      chat.addToolOutput({
        toolCallId,
        state: 'output-error',
        errorText: errorText(error),
      })
    }
  }

  return { ...chat, connected: agent.identified, send, resolveDeletion }
}

export type CanvasAgentChat = ReturnType<typeof useCanvasAgent>
