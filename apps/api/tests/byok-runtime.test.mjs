import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createRequire } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')
const { build } = wranglerRequire('esbuild')
const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
let runtime
let db
const requests = []

const fixture = async (request) => {
  const url = new URL(request.url)
  const key =
    request.headers.get('authorization') ??
    request.headers.get('x-api-key') ??
    request.headers.get('x-goog-api-key') ??
    ''
  const body = await request.json()
  requests.push({ url: url.href, key, body, redirect: request.redirect })
  if (key.includes('invalid-key'))
    return Response.json(
      {
        error: {
          message: 'Invalid API key: invalid-key',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      },
      { status: 401 },
    )
  if (key.includes('quota-key'))
    return Response.json(
      {
        error: {
          message: 'Billing quota exceeded',
          type: 'insufficient_quota',
          code: 'insufficient_quota',
        },
      },
      { status: 429 },
    )
  if (key.includes('redirect-key'))
    return new Response(null, {
      status: 302,
      headers: { location: 'https://untrusted.example.org' },
    })
  if (body.model === 'missing-model')
    return Response.json(
      { error: { message: 'model not found', code: 'model_not_found' } },
      { status: 404 },
    )
  if (url.hostname === 'api.openai.com')
    return Response.json({
      id: 'response-test',
      model: body.model,
      output: [
        {
          type: 'function_call',
          id: 'call-item',
          call_id: 'call-test',
          name: 'connection_check',
          arguments: '{"ok":true}',
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    })
  if (url.hostname === 'api.anthropic.com')
    return Response.json({
      id: 'message-test',
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [
        {
          type: 'tool_use',
          id: 'call-test',
          name: 'connection_check',
          input: { ok: true },
        },
      ],
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    })
  if (url.hostname === 'generativelanguage.googleapis.com')
    return Response.json({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                functionCall: { name: 'connection_check', args: { ok: true } },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 1,
        candidatesTokenCount: 1,
        totalTokenCount: 2,
      },
    })
  return Response.json({
    id: 'completion-test',
    object: 'chat.completion',
    created: 1,
    model: body.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-test',
              type: 'function',
              function: { name: 'connection_check', arguments: '{"ok":true}' },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  })
}

before(async () => {
  const result = await build({
    stdin: {
      contents: `
      import { aiConnectionsRouter } from './src/routers/ai-connections';
      import { createDb } from '@rhyme/db';
      import { resolveAgentModel } from './src/services/ai-connections';
      import { defaultAgentConfig } from './src/agents/agent-config';
      import { providerError } from './src/services/provider-errors';
      export default { async fetch(request, env) {
        const db = createDb(env.DB);
        const userId = request.headers.get('x-user');
        const caller = aiConnectionsRouter.createCaller({ db, env, user: userId ? { id: userId } : null, waitUntil() {} });
        const operation = new URL(request.url).pathname.slice(1);
        try {
          const input = request.method === 'POST' ? await request.json() : undefined;
          if (operation === 'resolve') {
            const result = await resolveAgentModel(db, env, userId, { ...defaultAgentConfig(input.model, input.id), serviceTier: input.serviceTier });
            return Response.json({ modelId: result.model.modelId, vision: result.vision, ...(input.includeOptions ? { providerOptions: result.providerOptions } : {}) });
          }
          return Response.json(await caller[operation](input));
        } catch (error) {
          return Response.json({ error: error.message, code: error.code ?? providerError(error).code }, { status: 400 });
        }
      }};
    `,
      resolveDir: root,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*', 'cloudflare:*'],
  })
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: result.outputFiles[0].text,
      compatibilityDate: '2026-09-01',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      bindings: { BETTER_AUTH_SECRET: 'fixture-encryption-secret-'.repeat(3) },
      outboundService: fixture,
    }),
  )
  db = (await runtime.getBindings()).DB
  const migrationDir = resolve(root, '../../packages/db/migrations')
  for (const file of (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(resolve(migrationDir, file), 'utf8')
    await db.exec(
      sql.replaceAll('--> statement-breakpoint', '').replaceAll('\n', ' '),
    )
  }
  await db.exec(
    "INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES ('user-a','A','a@example.org',1,1,1), ('user-b','B','b@example.org',1,1,1)",
  )
})
after(async () => runtime?.dispose())

async function call(operation, input, user = 'user-a') {
  const response = await runtime.dispatchFetch(
    `http://localhost/${operation}`,
    {
      method: input ? 'POST' : 'GET',
      headers: {
        ...(user ? { 'x-user': user } : {}),
        'content-type': 'application/json',
      },
      body: input ? JSON.stringify(input) : undefined,
    },
  )
  return response.json()
}
const input = (provider = 'openai', patch = {}) => ({
  name: 'Private provider',
  provider,
  apiKey: 'fixture-api-key',
  baseUrl:
    provider === 'compatible' ? 'https://custom-provider.example.org/v1' : '',
  models: ['custom-model'],
  vision: true,
  ...patch,
})

test('all four providers verify native tool calling in the Workers runtime', async () => {
  for (const provider of ['openai', 'anthropic', 'google', 'compatible']) {
    const checked = await call('test', input(provider))
    assert.equal(checked.model, 'custom-model', JSON.stringify(checked))
  }
  assert.ok(
    requests.find(
      (request) =>
        request.url.endsWith('/v1/responses') &&
        request.body.store === false &&
        request.body.tools[0].strict === false,
    ),
  )
  assert.ok(
    requests.find(
      (request) =>
        request.url.endsWith('/v1/messages') &&
        request.key === 'fixture-api-key',
    ),
  )
  assert.ok(
    requests.find(
      (request) =>
        request.url.includes('generativelanguage.googleapis.com') &&
        request.key === 'fixture-api-key',
    ),
  )
  assert.ok(
    requests.find((request) => request.url.endsWith('/v1/chat/completions')),
  )
})

test('saved credentials are encrypted and updates keep the key private', async () => {
  const saved = await call('save', input())
  assert.ok(saved.id, JSON.stringify(saved))
  assert.equal(saved.keyHint, '-key')
  assert.equal('apiKey' in saved, false)
  assert.equal('encryptedApiKey' in saved, false)
  const row = await db
    .prepare('SELECT encrypted_api_key FROM ai_connections WHERE id = ?')
    .bind(saved.id)
    .first()
  assert.ok(row.encrypted_api_key.startsWith('v1.'))
  assert.equal(row.encrypted_api_key.includes('fixture-api-key'), false)
  const edited = await call(
    'save',
    input('openai', {
      id: saved.id,
      apiKey: undefined,
      name: 'Renamed connection',
    }),
  )
  assert.equal(edited.name, 'Renamed connection')
  assert.deepEqual(
    await call('resolve', { id: saved.id, model: 'custom-model' }),
    { modelId: 'custom-model', vision: true },
  )
  assert.equal(
    (await call('resolve', { id: saved.id, model: 'removed-model' })).code,
    'model_removed',
  )
  assert.equal(
    (
      await call(
        'save',
        input('anthropic', { id: saved.id, apiKey: undefined }),
      )
    ).code,
    'BAD_REQUEST',
  )
  const failed = await call(
    'save',
    input('openai', {
      id: saved.id,
      apiKey: 'invalid-key',
      name: 'Should not save',
    }),
  )
  assert.match(failed.error, /rejected your API key/)
  assert.equal(
    (await call('list')).find((item) => item.id === saved.id).name,
    'Renamed connection',
  )
})

test('one account cannot list, use, edit, or delete another account’s connections', async () => {
  const saved = await call('save', input())
  assert.deepEqual(await call('list', undefined, 'user-b'), [])
  for (const operation of ['test', 'save'])
    assert.match(
      (
        await call(
          operation,
          input('openai', { id: saved.id, apiKey: undefined }),
          'user-b',
        )
      ).error,
      /removed or is unavailable/,
    )
  assert.equal(
    (await call('resolve', { id: saved.id, model: 'custom-model' }, 'user-b'))
      .code,
    'connection_missing',
  )
  await call('remove', { id: saved.id }, 'user-b')
  assert.ok((await call('list')).some((item) => item.id === saved.id))
  assert.equal((await call('list', undefined, null)).code, 'UNAUTHORIZED')
  await call('remove', { id: saved.id })
  assert.equal(
    (await call('resolve', { id: saved.id, model: 'custom-model' })).code,
    'connection_missing',
  )
})

test('provider errors and redirects are actionable without exposing the key', async () => {
  for (const [key, expected] of [
    ['invalid-key', /rejected your API key/],
    ['quota-key', /credits or quota/],
    ['redirect-key', /redirected/],
  ]) {
    const result = await call('test', input('openai', { apiKey: key }))
    assert.match(result.error, expected)
    assert.equal(result.error.includes(key), false)
  }
  assert.match(
    (await call('test', input('openai', { models: ['missing-model'] }))).error,
    /model is unavailable/,
  )
  assert.equal(
    requests.some((request) => request.url.includes('untrusted.example.org')),
    false,
  )
})

test('Ultrafast connection defaults reach OpenAI, while per-turn Standard overrides and unsupported models remain Standard', async () => {
  const start = requests.length
  const saved = await call(
    'save',
    input('openai', {
      models: ['gpt-6.1-sol', 'gpt-6-astra'],
      serviceTier: 'ultrafast',
    }),
  )
  assert.ok(saved.id, JSON.stringify(saved))
  assert.equal(saved.serviceTier, 'ultrafast')
  assert.equal(requests[start].body.model, 'gpt-6-astra')
  assert.equal(requests[start].body.service_tier, 'ultrafast')
  assert.equal(
    (await call('list')).find((item) => item.id === saved.id).serviceTier,
    'ultrafast',
  )
  const resolve = (model, serviceTier) =>
    call('resolve', { id: saved.id, model, serviceTier, includeOptions: true })
  assert.equal(
    (await resolve('gpt-6-astra')).providerOptions.openai.serviceTier,
    'ultrafast',
  )
  assert.equal(
    (await resolve('gpt-6-astra', 'standard')).providerOptions.openai
      .serviceTier,
    'default',
  )
  assert.equal(
    (await resolve('gpt-6.1-sol')).providerOptions.openai.serviceTier,
    'default',
  )
  assert.equal((await resolve('gpt-6.1-sol', 'ultrafast')).code, 'unsupported')
  const checked = await call(
    'test',
    input('openai', { models: ['gpt-5.6-sol'], serviceTier: 'ultrafast' }),
  )
  assert.equal(checked.model, 'gpt-5.6-sol')
  assert.equal(requests.at(-1).body.service_tier, 'ultrafast')
})
