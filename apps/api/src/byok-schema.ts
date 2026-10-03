import { z } from 'zod'

export const serviceTierSchema = z.enum(['standard', 'ultrafast'])

export function supportsUltrafast(provider: string, model: string) {
  return (
    provider === 'openai' &&
    /^(gpt-6-astra|gpt-5\.6-sol)(-\d{4}-\d{2}-\d{2})?$/.test(model)
  )
}

export const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna'],
    vision: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
    vision: true,
  },
  {
    id: 'google',
    label: 'Google Gemini',
    models: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
    vision: true,
  },
  { id: 'compatible', label: 'OpenAI-compatible', models: [], vision: false },
] as const

export const providerSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'compatible',
])
export type Provider = z.infer<typeof providerSchema>

export function isPublicProviderUrl(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (!url.port || url.port === '443') &&
      host.includes('.') &&
      !/^[\d.]+$/.test(host) &&
      !host.includes(':') &&
      !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) &&
      !host.endsWith('.localhost') &&
      !host.endsWith('.local') &&
      !host.endsWith('.internal') &&
      !host.endsWith('.arpa') &&
      host !== 'metadata.google.internal'
    )
  } catch {
    return false
  }
}

export const connectionInputSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, 'Enter a connection name.').max(80),
    provider: providerSchema,
    apiKey: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .regex(/^\S+$/, 'The API key must not contain spaces.')
      .optional(),
    baseUrl: z.string().trim().max(512).default(''),
    models: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(160)
          .regex(/^[a-zA-Z0-9._:/@-]+$/, 'Enter a valid model ID.'),
      )
      .min(1, 'Add at least one model.')
      .max(20)
      .transform((models) => [...new Set(models)]),
    vision: z.boolean().default(false),
    serviceTier: serviceTierSchema.default('standard'),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.serviceTier === 'ultrafast' &&
      !input.models.some((model) => supportsUltrafast(input.provider, model))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['serviceTier'],
        message:
          'Ultrafast requires an OpenAI GPT-6 Astra or GPT-5.6 Sol model.',
      })
    if (!input.id && !input.apiKey)
      ctx.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message: 'Enter an API key.',
      })
    if (input.provider === 'compatible' && !isPublicProviderUrl(input.baseUrl))
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message:
          'Enter a public HTTPS API base URL, such as https://openrouter.ai/api/v1.',
      })
    if (input.provider !== 'compatible' && input.baseUrl)
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message:
          'Custom URLs are only available for OpenAI-compatible connections.',
      })
  })

export type ConnectionInput = z.infer<typeof connectionInputSchema>
export type AIConnection = Omit<ConnectionInput, 'apiKey' | 'id'> & {
  id: string
  keyHint: string
}
