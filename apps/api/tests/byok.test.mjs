import assert from 'node:assert/strict'
import test from 'node:test'
import {
  connectionInputSchema,
  isPublicProviderUrl,
} from '../src/byok-schema.ts'
import {
  encryptProviderKey,
  decryptProviderKey,
} from '../src/services/provider-keys.ts'
import {
  ProviderError,
  providerError,
} from '../src/services/provider-errors.ts'
import {
  agentConfigSchema,
  defaultAgentConfig,
} from '../src/agents/agent-config.ts'

const connection = {
  name: 'My provider',
  provider: 'openai',
  apiKey: 'secret-key',
  models: ['gpt-6.1-sol'],
  vision: true,
}
const secret = 'a'.repeat(64)

test('keys are authenticated, randomized, and bound to the user and connection', async () => {
  const first = await encryptProviderKey(
    connection.apiKey,
    secret,
    'user:connection',
  )
  const second = await encryptProviderKey(
    connection.apiKey,
    secret,
    'user:connection',
  )
  assert.notEqual(first, second)
  assert.equal(first.includes(connection.apiKey), false)
  assert.equal(
    await decryptProviderKey(first, secret, 'user:connection'),
    connection.apiKey,
  )
  await assert.rejects(
    decryptProviderKey(first, secret, 'other-user:connection'),
  )
  await assert.rejects(
    decryptProviderKey(first, 'b'.repeat(64), 'user:connection'),
  )
  const parts = first.split('.')
  const bytes = Buffer.from(parts[2], 'base64')
  bytes[0] ^= 1
  parts[2] = bytes.toString('base64')
  await assert.rejects(
    decryptProviderKey(parts.join('.'), secret, 'user:connection'),
  )
  await assert.rejects(encryptProviderKey('key', 'short', 'user:connection'))
})

test('custom providers accept public HTTPS endpoints and reject credential-bearing or private URLs', () => {
  for (const url of [
    'https://openrouter.ai/api/v1',
    'https://api.groq.com/openai/v1',
    'https://my-provider.com/v1/',
  ])
    assert.equal(isPublicProviderUrl(url), true, url)
  for (const url of [
    'http://api.example.org/v1',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://169.254.169.254',
    'https://[::1]',
    'https://0x7f000001',
    'https://2130706433',
    'https://foo.local',
    'https://foo.internal',
    'https://api.example.org:8443/v1',
    'https://user:password@api.example.org/v1',
    'https://api.example.org?key=secret',
    'https://api.example.org#fragment',
    'not a url',
  ])
    assert.equal(isPublicProviderUrl(url), false, url)
})

test('connections validate providers, keys, models, and saved-key edits', () => {
  assert.equal(connectionInputSchema.safeParse(connection).success, true)
  assert.equal(
    connectionInputSchema.safeParse({
      ...connection,
      models: ['custom/future-model', 'custom/future-model'],
    }).data.models.length,
    1,
  )
  assert.equal(
    connectionInputSchema.safeParse({
      ...connection,
      provider: 'compatible',
      baseUrl: 'https://openrouter.ai/api/v1',
    }).success,
    true,
  )
  assert.equal(
    connectionInputSchema.safeParse({
      ...connection,
      id: crypto.randomUUID(),
      apiKey: undefined,
    }).success,
    true,
  )
  for (const patch of [
    { apiKey: undefined },
    { apiKey: 'key with spaces' },
    { provider: 'unknown' },
    { models: [] },
    { models: ['bad model'] },
    { models: Array(21).fill('model') },
    { provider: 'compatible', baseUrl: 'https://localhost' },
    { baseUrl: 'https://arbitrary-provider.com' },
    { encryptedApiKey: 'fake' },
  ])
    assert.equal(
      connectionInputSchema.safeParse({ ...connection, ...patch }).success,
      false,
    )
  const config = defaultAgentConfig('custom/future-model', crypto.randomUUID())
  assert.equal(agentConfigSchema.safeParse(config).success, true)
  assert.equal(
    agentConfigSchema.safeParse({ ...config, connectionId: undefined }).success,
    false,
  )
  assert.equal(
    agentConfigSchema.safeParse({ ...config, apiKey: 'secret' }).success,
    false,
  )
})

test('provider failures have actionable messages and never expose upstream secrets', () => {
  const cases = [
    [{ statusCode: 401 }, 'invalid_key'],
    [{ statusCode: 403 }, 'permission'],
    [{ statusCode: 404 }, 'model_unavailable'],
    [{ statusCode: 429 }, 'rate_limit'],
    [{ statusCode: 429, responseBody: 'insufficient_quota' }, 'quota'],
    [{ statusCode: 402 }, 'quota'],
    [
      { statusCode: 400, responseBody: 'context_length_exceeded' },
      'context_limit',
    ],
    [
      { statusCode: 400, responseBody: 'image inputs not supported' },
      'unsupported',
    ],
    [{ statusCode: 400, responseBody: 'content_filter' }, 'content_blocked'],
    [{ statusCode: 500 }, 'provider_unavailable'],
    [{ name: 'TimeoutError' }, 'timeout'],
    [{ name: 'AbortError' }, 'cancelled'],
    [{ message: 'fetch failed' }, 'connection'],
    [{ statusCode: 422 }, 'invalid_request'],
    [{}, 'unknown'],
  ]
  for (const [error, code] of cases) {
    const failure = providerError({
      cause: {
        ...error,
        message: `${error.message ?? ''} secret-api-key`,
        responseBody: `${error.responseBody ?? ''} secret-api-key`,
      },
    })
    assert.equal(failure.code, code)
    assert.equal(failure.message.includes('secret-api-key'), false)
  }
  const safe = new ProviderError(
    'connection_missing',
    'Choose another saved connection.',
  )
  assert.equal(providerError(safe), safe)
})
