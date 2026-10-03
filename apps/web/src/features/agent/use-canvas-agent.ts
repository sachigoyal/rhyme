import type { UIMessage } from 'ai'
import { useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import { useEffect, useRef, useState } from 'react'
import { useAgentChat } from '@cloudflare/ai-chat/react'
import { useAgent } from 'agents/react'
import { AGENT_MODELS } from 'api/agent-config'
import type { AgentState } from 'api/agent-config'
import type { Editor } from 'tldraw'
import { useRecordChatChange } from '@rhyme/hooks/mutations'
import { env } from '@/lib/env'
import { buildCanvasContext, captureCanvasPreview } from './canvas-context'
import {
  createCanvasToolRunner,
  continuingToolResult,
} from './canvas-tool-runner'
import { useAssistantPreferences } from './assistant-preferences'
import { getCanvasAgentOptions } from './agent-connection'
import { beginEditorBatch } from '../editor/editor-batch'

export function useCanvasAgent(
  fileId: string,
  conversationId: string,
  editor: Editor,
  initialMessages: UIMessage[],
  ready: boolean,
) {
  const [runner] = useState(() => createCanvasToolRunner(editor))
  const [requestPending, setRequestPending] = useState(false)
  const [activeTools, setActiveTools] = useState(0)
  const requestInFlight = useRef(false)
  const recordChange = useRecordChatChange()
  const { config, connections, configure } = useAssistantPreferences()
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const agent = useAgent<AgentState>({
    enabled: ready,
    ...getCanvasAgentOptions(fileId, conversationId, env.apiUrl),
    onMessage: (event) => runner.receive(event.data),
  })
  const configRef = useRef(config)
  if (!requestInFlight.current) configRef.current = config

  const savePreview = (toolCallId: string, preview: string | null) => {
    if (preview)
      recordChange.mutate(
        { id: conversationId, toolCallId, preview },
        {
          onError: (error) =>
            console.warn('Canvas change preview could not be saved', error),
        },
      )
  }

  const saveChangePreview = (toolCallId: string, screenshot: string | null) => {
    if (screenshot) savePreview(toolCallId, screenshot)
    else
      void captureCanvasPreview(editor, 480).then((preview) =>
        savePreview(toolCallId, preview),
      )
  }

  const currentVision = () => {
    const settings = configRef.current
    return settings.connectionId
      ? (connections.data?.find((item) => item.id === settings.connectionId)
          ?.vision ?? false)
      : (AGENT_MODELS.find((item) => item.id === settings.model)?.vision ??
          false)
  }

  const refresh = async (toolCallId: string) => {
    const canvas = await buildCanvasContext(editor, currentVision())
    try {
      await agent.call('refreshCanvas', [toolCallId, canvas])
    } catch (error) {
      console.warn('Live canvas context could not be refreshed', error)
    }
    return canvas
  }

  const chat = useAgentChat({
    agent,
    messages: initialMessages,
    getInitialMessages: null,
    credentials: 'include',
    body: async () => {
      const turnConfig = configRef.current
      const model = turnConfig.connectionId
        ? connections.data?.find((item) => item.id === turnConfig.connectionId)
        : AGENT_MODELS.find((item) => item.id === turnConfig.model)
      return {
        config: turnConfig,
        canvas: await buildCanvasContext(editor, model?.vision ?? false),
      }
    },
    onToolCall: async ({ toolCall, addToolOutput }) => {
      if (toolCall.toolName === 'delete_shapes') return
      setActiveTools((count) => count + 1)
      try {
        const execution = await runner.run(
          toolCall.toolCallId,
          toolCall.toolName,
          toolCall.input,
        )
        const canvas = await refresh(toolCall.toolCallId)
        await addToolOutput({
          toolCallId: toolCall.toolCallId,
          ...continuingToolResult(execution.result),
        })
        if (execution.applied)
          saveChangePreview(toolCall.toolCallId, canvas.screenshot)
      } finally {
        setActiveTools((count) => count - 1)
      }
    },
  })

  const firstUserId = chat.messages.find(
    (message) => message.role === 'user',
  )?.id
  useEffect(() => {
    if (!firstUserId) return
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries(trpc.chats.list.queryFilter())
      void queryClient.invalidateQueries(trpc.chats.activity.queryFilter())
    }, 1000)
    return () => clearTimeout(timer)
  }, [firstUserId, queryClient, trpc])

  const busy =
    requestPending ||
    activeTools > 0 ||
    agent.state?.status === 'running' ||
    chat.status === 'submitted' ||
    chat.status === 'streaming' ||
    chat.isServerStreaming ||
    chat.isRecovering ||
    chat.isToolContinuation

  useEffect(() => {
    if (busy) return beginEditorBatch(editor)
  }, [busy, editor])

  useEffect(() => () => runner.cancel(), [runner])

  const startRequest = (request: () => Promise<void>) => {
    if (requestInFlight.current || busy || !agent.identified) return false
    requestInFlight.current = true
    setRequestPending(true)
    runner.beginTurn()
    const release = beginEditorBatch(editor)
    void request()
      .catch((error: unknown) =>
        console.warn('Assistant request could not complete', error),
      )
      .finally(() => {
        release()
        requestInFlight.current = false
        setRequestPending(false)
      })
    return true
  }

  const send = (text: string, messageId?: string, id?: string) =>
    startRequest(() =>
      chat.sendMessage(
        id
          ? { id, role: 'user', parts: [{ type: 'text', text }] }
          : { text, messageId },
      ),
    )

  const regenerate = (messageId?: string) =>
    startRequest(() => chat.regenerate({ messageId }))

  const resolveDeletion = async (
    toolCallId: string,
    input: unknown,
    approved: boolean,
  ) => {
    if (!approved) {
      await chat.addToolOutput({
        toolCallId,
        ...continuingToolResult(
          runner.reject(
            toolCallId,
            'The user declined this deletion. Keep these shapes and do not retry.',
          ),
        ),
      })
      return
    }
    setActiveTools((count) => count + 1)
    try {
      const execution = await runner.run(toolCallId, 'delete_shapes', input)
      const canvas = await refresh(toolCallId)
      await chat.addToolOutput({
        toolCallId,
        ...continuingToolResult(execution.result),
      })
      if (execution.applied) saveChangePreview(toolCallId, canvas.screenshot)
    } finally {
      setActiveTools((count) => count - 1)
    }
  }

  return {
    ...chat,
    stop: async () => {
      runner.cancel()
      await chat.stop()
    },
    quotaExceeded:
      agent.state?.errorCode === 'free_quota' && !config.connectionId,
    error:
      chat.error ??
      (agent.state?.error ? new Error(agent.state.error) : undefined),
    busy,
    usingTools: activeTools > 0,
    config,
    configure,
    connected: agent.identified,
    reconnect: () => agent.reconnect(),
    send,
    regenerate,
    resolveDeletion,
  }
}
