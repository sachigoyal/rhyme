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
let runtime, db, storage
const fileId = '00000000-0000-4000-8000-000000000001'
const chatId = '00000000-0000-4000-8000-000000000002'

before(async () => {
  const result = await build({
    stdin: {
      resolveDir: root,
      contents: `
      import { filesRouter } from './src/routers/files';
      import { chatsRouter } from './src/routers/chats';
      import { createDb } from '@rhyme/db';
      import { Hono } from 'hono';
      import { storageRoutes } from './src/routes/storage';
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('db', createDb(c.env.DB));
        c.set('auth', {api:{getSession:async () => {
          const id = c.req.header('x-user');
          const user = id && await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
          return user ? {user} : null;
        }}});
        await next();
      });
      app.route('/', storageRoutes);
      export default { async fetch(request, env, context) {
        if (new URL(request.url).pathname.startsWith('/profile/')) return app.fetch(request, env, context);
        const ctx = { db: createDb(env.DB), env, user: { id: request.headers.get('x-user') ?? 'owner' }, waitUntil: (p) => context.waitUntil(p) };
        try {
          const action = new URL(request.url).pathname.slice(1);
          const result = action === 'analytics' ? await chatsRouter.createCaller(ctx).analytics({days:30}) : action === 'activity' ? await chatsRouter.createCaller(ctx).activity() : await filesRouter.createCaller(ctx)[action]({id:'${fileId}'});
          return Response.json(result ?? {});
        } catch(error) { return Response.json({code:error.code, error:error.message}, {status:400}); }
      }};
    `,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*', 'cloudflare:*', 'path'],
  })
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: result.outputFiles[0].text,
      compatibilityDate: '2026-09-01',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      r2Buckets: ['STORAGE'],
      bindings: { API_URL: 'https://test' },
    }),
  )
  db = await runtime.getD1Database('DB')
  storage = await runtime.getR2Bucket('STORAGE')
  const directory = resolve(root, '../../packages/db/migrations')
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith('.sql') && !name.startsWith('0007'))
    .sort()) {
    const sql = await readFile(resolve(directory, name), 'utf8')
    await db.exec(
      sql.replaceAll('--> statement-breakpoint', '').replaceAll('\n', ' '),
    )
  }
  const now = Date.now()
  await db
    .prepare(
      'INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?, ?, ?, 1, ?, ?)',
    )
    .bind('owner', 'Owner', 'owner@example.com', now, now)
    .run()
  await db
    .prepare(
      'INSERT INTO files (id,owner_id,name,created_at,updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(fileId, 'owner', 'Canvas', now, now)
    .run()
  await db
    .prepare(
      'INSERT INTO chats (id,file_id,user_id,title,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(chatId, fileId, 'owner', 'Conversation', now, now)
    .run()
  await db
    .prepare(
      "INSERT INTO agent_runs (id,chat_id,model,status,total_tokens,tool_call_count,created_at) VALUES ('run', ?, 'test', 'completed', 42, 3, ?)",
    )
    .bind(chatId, now)
    .run()
  await db
    .prepare(
      "INSERT INTO chat_changes (id,chat_id,tool_call_id,tool_name,summary,created_at) VALUES ('change', ?, 'tool', 'create', 'Created shape', ?)",
    )
    .bind(chatId, now)
    .run()
  await db
    .prepare(
      'INSERT INTO legacy_chat_imports (file_id,user_id,chat_id,created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(fileId, 'owner', chatId, now)
    .run()
  const sql = await readFile(
    resolve(directory, '0007_hesitant_venom.sql'),
    'utf8',
  )
  await db.batch(
    sql
      .replaceAll('--> statement-breakpoint', '')
      .split(';')
      .filter((part) => part.trim())
      .map((part) => db.prepare(part)),
  )
  for (const key of [
    `files/${fileId}/documents/a.json`,
    `files/${fileId}/assets/a`,
    `files/${fileId}/thumbnail`,
    `files/${fileId}/chats/${chatId}/preview.jpg`,
  ])
    await storage.put(key, 'fixture')
})
after(async () => {
  await runtime?.dispose()
})
const call = (operation, user = 'owner') =>
  runtime.dispatchFetch(`https://test/${operation}`, {
    headers: { 'x-user': user },
  })

test('migration preserves chats, runs, changes, and legacy import links', async () => {
  for (const table of ['chats', 'agent_runs', 'chat_changes'])
    assert.equal(
      (await db.prepare(`SELECT count(*) AS count FROM ${table}`).first())
        .count,
      1,
    )
  assert.equal(
    (await db.prepare('SELECT chat_id FROM legacy_chat_imports').first())
      .chat_id,
    chatId,
  )
  assert.equal(
    (await db.prepare('PRAGMA foreign_key_check').all()).results.length,
    0,
  )
})

test('trash and permanent deletion preserve activity and isolate it by user', async () => {
  assert.equal((await call('destroy', 'other')).status, 400)
  assert.equal((await call('trash')).status, 200)
  assert.equal((await (await call('analytics')).json()).totalTokens, 42)
  assert.equal((await (await call('activity')).json())[0].available, false)
  assert.equal((await call('destroy')).status, 200)
  const activity = await (await call('activity')).json()
  assert.equal(activity[0].id, chatId)
  assert.equal(activity[0].available, false)
  assert.equal(activity[0].totalTokens, 42)
  assert.equal((await (await call('analytics')).json()).runCount, 1)
  assert.equal((await (await call('analytics', 'other')).json()).runCount, 0)
  assert.deepEqual(await (await call('activity', 'other')).json(), [])
  assert.equal(
    (await db.prepare('SELECT count(*) AS count FROM chat_changes').first())
      .count,
    1,
  )
  assert.equal(await storage.get(`files/${fileId}/documents/a.json`), null)
  assert.equal(await storage.get(`files/${fileId}/assets/a`), null)
  assert.ok(await storage.get(`files/${fileId}/chats/${chatId}/preview.jpg`))
})

test('profile uploads authenticate, validate type and size, persist, replace and reset', async () => {
  const upload = (body, type, user = 'owner') =>
    runtime.dispatchFetch('https://test/profile/picture', {
      method: 'PUT',
      headers: { 'content-type': type, 'x-user': user },
      body,
    })
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
  assert.equal((await upload(png, 'image/png', '')).status, 401)
  assert.equal((await upload('<svg/>', 'image/svg+xml')).status, 415)
  assert.equal((await upload('invalid', 'image/png')).status, 415)
  assert.equal(
    (await upload(new Uint8Array(2 * 1024 * 1024 + 1), 'image/png')).status,
    413,
  )
  const first = await (await upload(png, 'image/png')).json()
  assert.equal(
    (await db.prepare("SELECT image FROM users WHERE id = 'owner'").first())
      .image,
    first.image,
  )
  assert.equal((await runtime.dispatchFetch(first.image)).status, 200)
  const second = await (await upload(png, 'image/png')).json()
  assert.notEqual(first.image, second.image)
  assert.equal((await runtime.dispatchFetch(first.image)).status, 404)
  assert.equal(
    (
      await runtime.dispatchFetch('https://test/profile/picture', {
        method: 'DELETE',
        headers: { 'x-user': 'owner' },
      })
    ).status,
    200,
  )
  assert.equal(
    (await db.prepare("SELECT image FROM users WHERE id = 'owner'").first())
      .image,
    null,
  )
  assert.equal((await runtime.dispatchFetch(second.image)).status, 404)
})
