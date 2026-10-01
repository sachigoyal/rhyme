import { z } from 'zod'

const reasoning = z.enum(['off', 'low', 'medium', 'high'])

type AgentModel = {
  id: string
  label: string
  description: string
  vision: boolean
  reasoningMode: 'toggle' | 'effort'
  reasoningOptions: Array<{ value: z.infer<typeof reasoning>; label: string }>
}

export const AGENT_MODELS: Array<AgentModel> = [
  {
    id: '@cf/moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    description: 'Canvas images, reasoning, and tools',
    vision: true,
    reasoningMode: 'toggle',
    reasoningOptions: [
      { value: 'off', label: 'Off' },
      { value: 'high', label: 'On' },
    ],
  },
  {
    id: '@cf/openai/gpt-oss-120b',
    label: 'GPT OSS 120B',
    description: 'Reasoning and tools · reads canvas shapes',
    vision: false,
    reasoningMode: 'effort',
    reasoningOptions: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    id: '@cf/openai/gpt-oss-20b',
    label: 'GPT OSS 20B',
    description: 'Reasoning and tools · reads canvas shapes',
    vision: false,
    reasoningMode: 'effort',
    reasoningOptions: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
]

export const agentConfigSchema = z
  .object({
    model: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-zA-Z0-9._:/@-]+$/),
    connectionId: z.uuid().optional(),
    temperature: z.number().min(0).max(2),
    maxOutputTokens: z.number().int().min(256).max(8192),
    maxSteps: z.number().int().min(1).max(12),
    reasoning,
  })
  .strict()
  .superRefine((config, ctx) => {
    if (config.connectionId) return
    const model = AGENT_MODELS.find((model) => model.id === config.model)
    if (!model)
      ctx.addIssue({
        code: 'custom',
        path: ['model'],
        message: 'Choose an available model',
      })
    if (
      model &&
      !model.reasoningOptions.some(
        (option) => option.value === config.reasoning,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasoning'],
        message: 'This reasoning setting is unavailable for the selected model',
      })
    }
  })

export type AgentConfig = z.infer<typeof agentConfigSchema>
export type AgentState = {
  status: 'ready' | 'running' | 'error'
  config?: AgentConfig
  error?: string
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: '@cf/moonshotai/kimi-k2.6',
  temperature: 0.6,
  maxOutputTokens: 4096,
  maxSteps: 8,
  reasoning: 'high',
}

export function defaultAgentConfig(
  modelId: string,
  connectionId?: string,
): AgentConfig {
  if (connectionId)
    return {
      ...DEFAULT_AGENT_CONFIG,
      model: modelId,
      connectionId,
      reasoning: 'off',
    }
  const model = AGENT_MODELS.find((model) => model.id === modelId)
  if (!model) return DEFAULT_AGENT_CONFIG
  return {
    ...DEFAULT_AGENT_CONFIG,
    model: model.id,
    reasoning: model.reasoningOptions.some((option) => option.value === 'high')
      ? ('high' as const)
      : ('off' as const),
  }
}

export function modelOptions(config: AgentConfig) {
  const model = AGENT_MODELS.find((model) => model.id === config.model)
  if (!model) throw new Error('Choose an available model')
  return {
    vision: model.vision,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    maxSteps: config.maxSteps,
    providerOptions: {
      'workers-ai':
        model.reasoningMode === 'toggle'
          ? {
              reasoning_effort: config.reasoning === 'off' ? 'none' : 'high',
              chat_template_kwargs: {
                enable_thinking: config.reasoning !== 'off',
              },
            }
          : { reasoning_effort: config.reasoning },
    },
  }
}

export function remainingToolSteps(
  messages: Array<{ role: string; parts: Array<{ type: string }> }>,
  maxSteps: number,
) {
  const last = messages.at(-1)
  const used =
    last?.role === 'assistant'
      ? last.parts.filter((part) => part.type === 'step-start').length
      : 0
  return Math.max(0, maxSteps - used)
}
