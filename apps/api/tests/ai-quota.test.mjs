import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createRequire } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const runtimeRequire = createRequire(require.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = runtimeRequire('miniflare')
const { build } = runtimeRequire('esbuild')
const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
let runtime

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { acquireAIQuota, monthlyTokenLimit } from './src/services/ai-quota';
        const leases = new Map();
        export default { async fetch(request, env) {
          const { action, user, limit, now, id, tokens } = await request.json();
          try {
            if (action === 'limit') return Response.json({ limit: monthlyTokenLimit(limit) });
            if (action === 'acquire') {
              const lease = await acquireAIQuota(env.DB, user, limit, now);
              const key = crypto.randomUUID();
              leases.set(key, lease);
              return Response.json({ id: key });
            }
            const lease = leases.get(id);
            if (action === 'charge') await lease.charge(tokens);
            if (action === 'release') await lease.release();
            if (action === 'check') lease.check();
            return Response.json({ exceeded: lease.exceeded });
          } catch (error) { return Response.json({ error: error.message, code: error.code }); }
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
    }),
  )
  const db = (await runtime.getBindings()).DB
  const dir = resolve(root, '../../packages/db/migrations')
  for (const file of (await readdir(dir))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(resolve(dir, file), 'utf8')
    await db.exec(
      sql.replaceAll('--> statement-breakpoint', '').replaceAll('\n', ' '),
    )
  }
  await db.exec(
    "INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES ('a','A','a@example.org',1,1,1),('b','B','b@example.org',1,1,1)",
  )
})
after(async () => runtime?.dispose())

async function call(input) {
  return (
    await runtime.dispatchFetch('http://localhost/', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).json()
}
const now = Date.parse('2026-10-02T00:00:00Z')
const acquire = (user, time = now, limit = 100) =>
  call({ action: 'acquire', user, now: time, limit })

test('monthly configuration defaults, zero, and invalid values', async () => {
  assert.equal((await call({ action: 'limit' })).limit, 100_000)
  assert.equal((await call({ action: 'limit', limit: '0' })).limit, 0)
  for (const limit of ['-1', 'oops', '', '1.5'])
    assert.ok((await call({ action: 'limit', limit })).error)
})

test('atomic admission across chats, usage accounting, account isolation and monthly reset', async () => {
  const claims = await Promise.all([acquire('a'), acquire('a')])
  assert.equal(claims.filter((item) => item.id).length, 1)
  assert.equal(claims.find((item) => item.code)?.code, 'free_ai_busy')
  const id = claims.find((item) => item.id).id
  const other = await acquire('b')
  assert.ok(other.id)
  await call({ action: 'release', id: other.id })
  await call({ action: 'charge', id, tokens: 60 })
  await call({ action: 'charge', id, tokens: 60 })
  await call({ action: 'charge', id, tokens: 50 })
  await call({ action: 'release', id })
  const next = await acquire('a')
  assert.ok(next.id, 'duplicate reports must not double charge')
  assert.equal(
    (await call({ action: 'charge', id: next.id, tokens: 40 })).exceeded,
    true,
  )
  assert.equal(
    (await call({ action: 'check', id: next.id })).code,
    'free_quota',
  )
  await call({ action: 'release', id: next.id })
  assert.equal((await acquire('a')).code, 'free_quota')
  assert.ok((await acquire('a', Date.parse('2026-11-01T00:00:00Z'))).id)
})

test('expired leases recover, stale releases cannot unlock a new response, and zero disables free AI', async () => {
  const first = await acquire('b')
  const second = await acquire('b', now + 180_001)
  assert.ok(second.id)
  await call({ action: 'release', id: first.id })
  assert.equal((await acquire('b', now + 180_002)).code, 'free_ai_busy')
  await call({ action: 'release', id: second.id })
  assert.equal((await acquire('b', now + 180_003, 0)).code, 'free_quota')
})
