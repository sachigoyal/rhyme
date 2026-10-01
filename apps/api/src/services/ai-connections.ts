import { and, eq } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import type { Database } from '@rhyme/db'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createWorkersAI } from 'workers-ai-provider'
import { generateText, tool } from 'ai'
import type { LanguageModel } from 'ai'
import { z } from 'zod'
import type { Env } from '../env'
import type { AgentConfig } from '../agents/agent-config'
import { modelOptions } from '../agents/agent-config'
import type { ConnectionInput } from '../byok-schema'
import { isPublicProviderUrl } from '../byok-schema'
import { decryptProviderKey } from './provider-keys'
import { ProviderError, providerError } from './provider-errors'

export async function getAIConnection(
  db: Database,
  userId: string,
  id: string,
) {
  const connection = await db
    .select()
    .from(schema.aiConnections)
    .where(
      and(
        eq(schema.aiConnections.id, id),
        eq(schema.aiConnections.userId, userId),
      ),
    )
    .get()
  if (!connection)
    throw new ProviderError(
      'connection_missing',
      'This AI connection was removed or is unavailable. Choose another model, or add a connection in Settings → AI connections.',
    )
  return connection
}

export async function connectionKey(
  connection: typeof schema.aiConnections.$inferSelect,
  env: Env,
) {
  try {
    return await decryptProviderKey(
      connection.encryptedApiKey,
      env.BYOK_ENCRYPTION_KEY || env.BETTER_AUTH_SECRET,
      `${connection.userId}:${connection.id}`,
    )
  } catch {
    throw new ProviderError(
      'key_unavailable',
      'This saved API key could not be read. Replace it in Settings → AI connections.',
    )
  }
}

export function providerModel(
  connection: Pick<ConnectionInput, 'provider' | 'baseUrl'>,
  apiKey: string,
  model: string,
): LanguageModel {
  const providerFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      throw new ProviderError(
        'connection',
        'The provider redirected the request. Update the API base URL to its final HTTPS endpoint.',
      )
    }
    return response
  }
  switch (connection.provider) {
    case 'openai':
      return createOpenAI({ apiKey, fetch: providerFetch }).responses(model)
    case 'anthropic':
      return createAnthropic({ apiKey, fetch: providerFetch })(model)
    case 'google':
      return createGoogleGenerativeAI({ apiKey, fetch: providerFetch })(model)
    case 'compatible': {
      if (!isPublicProviderUrl(connection.baseUrl))
        throw new ProviderError(
          'invalid_url',
          'Enter a public HTTPS API base URL in your connection settings.',
        )
      return createOpenAICompatible({
        name: 'custom',
        apiKey,
        baseURL: connection.baseUrl.replace(/\/+$/, ''),
        fetch: providerFetch,
      })(model)
    }
  }
}

export function externalModelOptions(provider: ConnectionInput['provider']) {
  return provider === 'openai'
    ? { openai: { strictJsonSchema: false, store: false } }
    : undefined
}

export async function resolveAgentModel(
  db: Database,
  env: Env,
  userId: string,
  config: AgentConfig,
) {
  if (!config.connectionId) {
    return {
      model: createWorkersAI({
        binding: env.AI as unknown as NonNullable<
          Parameters<typeof createWorkersAI>[0]['binding']
        >,
      })(config.model),
      ...modelOptions(config),
    }
  }
  const connection = await getAIConnection(db, userId, config.connectionId)
  if (!connection.models.includes(config.model))
    throw new ProviderError(
      'model_removed',
      'This model was removed from your connection. Choose another model or add its model ID in Settings → AI connections.',
    )
  return {
    model: providerModel(
      connection,
      await connectionKey(connection, env),
      config.model,
    ),
    vision: connection.vision,
    maxSteps: config.maxSteps,
    maxOutputTokens: config.maxOutputTokens,
    providerOptions: externalModelOptions(connection.provider),
  }
}

export async function testAIConnection(input: ConnectionInput, apiKey: string) {
  const result = await generateText({
    model: providerModel(input, apiKey, input.models[0]!),
    providerOptions: externalModelOptions(input.provider),
    prompt: 'Call the connection_check tool with ok set to true.',
    tools: {
      connection_check: tool({
        description: 'Verify tool calling.',
        inputSchema: z.object({ ok: z.boolean() }),
      }),
    },
    toolChoice: 'required',
    maxOutputTokens: 1024,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30000),
  }).catch((error: unknown) => {
    console.warn(
      JSON.stringify({
        event: 'byok.test.failed',
        provider: input.provider,
        errorCode: providerError(error).code,
      }),
    )
    throw error
  })
  if (
    !result.toolCalls.some(
      (call) =>
        call.toolName === 'connection_check' &&
        z.object({ ok: z.literal(true) }).safeParse(call.input).success,
    )
  )
    throw new ProviderError(
      'tools_unsupported',
      'This model did not complete a tool call. Choose a model that supports tool calling for the canvas assistant.',
    )
  return {
    model: input.models[0]!,
    message: 'Connected. API key, model access, and tool calling verified.',
  }
}
