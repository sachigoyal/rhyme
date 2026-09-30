import { useRef, useState } from 'react'
import { useAgentChat } from '@cloudflare/ai-chat/react'
import { useAgent } from 'agents/react'
import { AGENT_MODELS, DEFAULT_AGENT_CONFIG } from 'api/agent-config'
import type { AgentConfig, AgentState } from 'api/agent-config'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import { useRecordChatChange } from '@rhyme/hooks/mutations'
import { env } from '@/lib/env'
import { buildCanvasContext, captureCanvasPreview } from './canvas-context'
import { createCanvasToolRunner } from './canvas-tool-runner'
import { getCanvasAgentOptions } from './agent-connection'

export function useCanvasAgent(
  fileId: string,
  conversationId: string,
  editor: Editor,
) {
  const [runner] = useState(() => createCanvasToolRunner(editor))
  const [requestPending, setRequestPending] = useState(false)
  const [activeTools, setActiveTools] = useState(0)
  const requestInFlight = useRef(false)
  const [configSaving, setConfigSaving] = useState(false)
  const configInFlight = useRef(false)
  const recordChange = useRecordChatChange()
  const agent = useAgent<AgentState>(
    getCanvasAgentOptions(fileId, conversationId, env.apiUrl),
  )
  const config = agent.state?.config ?? DEFAULT_AGENT_CONFIG
  const configRef = useRef(config)
  configRef.current = config

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

  const chat = useAgentChat({
    agent,
    credentials: 'include',
    body: async () => {
      const turnConfig = configRef.current
      const model = AGENT_MODELS.find((item) => item.id === turnConfig.model)
      return {
        config: turnConfig,
        canvas: await buildCanvasContext(editor, model?.vision ?? false),
      }
    },
    onToolCall: async ({ toolCall, addToolOutput }) => {
      if (toolCall.toolName === 'delete_shapes') return
      setActiveTools((count) => count + 1)
      try {
        const execution = runner.run(
          toolCall.toolCallId,
          toolCall.toolName,
          toolCall.input,
        )
        const preview = execution.applied
          ? await captureCanvasPreview(editor, 480)
          : null
        await addToolOutput({
          toolCallId: toolCall.toolCallId,
          ...execution.result,
        })
        savePreview(toolCall.toolCallId, preview)
      } finally {
        setActiveTools((count) => count - 1)
      }
    },
  })

  const busy =
    requestPending ||
    activeTools > 0 ||
    agent.state?.status === 'running' ||
    chat.status === 'submitted' ||
    chat.status === 'streaming' ||
    chat.isServerStreaming ||
    chat.isRecovering ||
    chat.isToolContinuation

  const startRequest = (request: () => Promise<void>) => {
    if (
      requestInFlight.current ||
      configInFlight.current ||
      busy ||
      !agent.identified
    )
      return false
    requestInFlight.current = true
    setRequestPending(true)
    runner.beginTurn()
    void request()
      .catch((error: unknown) =>
        console.warn('Assistant request could not complete', error),
      )
      .finally(() => {
        requestInFlight.current = false
        setRequestPending(false)
      })
    return true
  }

  const send = (text: string, messageId?: string) =>
    startRequest(() => chat.sendMessage({ text, messageId }))

  const regenerate = (messageId?: string) =>
    startRequest(() => chat.regenerate({ messageId }))

  const configure = async (nextConfig: AgentConfig) => {
    if (
      requestInFlight.current ||
      configInFlight.current ||
      busy ||
      !agent.identified
    )
      return false
    configInFlight.current = true
    setConfigSaving(true)
    try {
      configRef.current = await agent.call<AgentConfig>('configure', [
        nextConfig,
      ])
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Model settings could not be saved',
      )
      return false
    } finally {
      configInFlight.current = false
      setConfigSaving(false)
    }
  }

  const resolveDeletion = async (
    toolCallId: string,
    input: unknown,
    approved: boolean,
  ) => {
    if (!approved) {
      await chat.addToolOutput({
        toolCallId,
        ...runner.reject(toolCallId, 'The user declined this deletion.'),
      })
      return
    }
    setActiveTools((count) => count + 1)
    try {
      const execution = runner.run(toolCallId, 'delete_shapes', input)
      const preview = execution.applied
        ? await captureCanvasPreview(editor, 480)
        : null
      await chat.addToolOutput({ toolCallId, ...execution.result })
      savePreview(toolCallId, preview)
    } finally {
      setActiveTools((count) => count - 1)
    }
  }

  return {
    ...chat,
    busy,
    usingTools: activeTools > 0,
    config,
    configure,
    configSaving,
    connected: agent.identified,
    send,
    regenerate,
    resolveDeletion,
  }
}
