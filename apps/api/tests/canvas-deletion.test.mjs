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
const thumbnailFileId = '00000000-0000-4000-8000-000000000003'

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
        const path = new URL(request.url).pathname;
        if (path.startsWith('/profile/') || path.startsWith('/files/')) {
          const storage = request.headers.has('x-race') ? {
            put: async (...args) => {
              const result = await env.STORAGE.put(...args);
              await env.DB.prepare('UPDATE files SET version = version + 1, thumbnail_key = NULL WHERE id = ?').bind(path.split('/')[2]).run();
              return result;
            },
            delete: (...args) => env.STORAGE.delete(...args),
          } : env.STORAGE;
          return app.fetch(request, {...env, STORAGE: storage}, context);
        }
        const ctx = { db: createDb(env.DB), env, user: { id: request.headers.get('x-user') ?? 'owner' }, waitUntil: (p) => context.waitUntil(p) };
        try {
          const action = new URL(request.url).pathname.slice(1);
          const input = request.method === 'POST' ? await request.json() : {};
          const result = action === 'createChat' ? await chatsRouter.createCaller(ctx).create(input) : action === 'analytics' ? await chatsRouter.createCaller(ctx).analytics({days:30}) : action === 'activity' ? await chatsRouter.createCaller(ctx).activity() : await filesRouter.createCaller(ctx)[action]('ids' in input ? input : {id:new URL(request.url).searchParams.get('id') ?? '${fileId}', ...input});
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
    `files/${fileId}/thumbnails/a`,
    `files/${fileId}/chats/${chatId}/preview.jpg`,
  ])
    await storage.put(key, 'fixture')
})
after(async () => {
  await runtime?.dispose()
})
const call = (operation, user = 'owner', id = fileId) =>
  runtime.dispatchFetch(`https://test/${operation}?id=${id}`, {
    headers: { 'x-user': user },
  })

test('optimistic conversation IDs are idempotent and cannot overwrite or expose another account chat', async () => {
  const id = crypto.randomUUID()
  const create = async (user, file = fileId) => {
    const response = await runtime.dispatchFetch('https://test/createChat', {
      method: 'POST',
      headers: { 'x-user': user, 'content-type': 'application/json' },
      body: JSON.stringify({ id, fileId: file }),
    })
    return response.json()
  }
  try {
    const first = await create('owner')
    const retry = await create('owner')
    assert.equal(first.id, id)
    assert.deepEqual(retry, first)
    assert.equal(
      (
        await db
          .prepare('SELECT count(*) AS count FROM chats WHERE id = ?')
          .bind(id)
          .first()
      ).count,
      1,
    )
    assert.equal((await create('stranger')).code, 'NOT_FOUND')
    await db.exec(
      "INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES ('editor','Editor','editor@example.com',1,1,1)",
    )
    await db
      .prepare(
        "INSERT INTO file_collaborators (file_id,user_id,role,created_at,updated_at) VALUES (?,'editor','editor',1,1)",
      )
      .bind(fileId)
      .run()
    await db
      .prepare(
        "INSERT INTO legacy_chat_imports (file_id,user_id,created_at) VALUES (?,'editor',1)",
      )
      .bind(fileId)
      .run()
    const conflict = await create('editor')
    assert.equal(conflict.code, 'CONFLICT')
    assert.equal(conflict.userId, undefined)
    assert.equal(
      (
        await db
          .prepare('SELECT user_id FROM chats WHERE id = ?')
          .bind(id)
          .first()
      ).user_id,
      'owner',
    )
  } finally {
    await db.prepare('DELETE FROM chats WHERE id = ?').bind(id).run()
    await db.exec(
      "DELETE FROM file_collaborators WHERE user_id = 'editor'; DELETE FROM legacy_chat_imports WHERE user_id = 'editor'; DELETE FROM users WHERE id = 'editor'",
    )
  }
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

test('thumbnails follow saved versions, clear on deletion, and reject uploads overtaken by a save', async () => {
  await db
    .prepare(
      'INSERT INTO files (id,owner_id,name,created_at,updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(thumbnailFileId, 'owner', 'Thumbnail canvas', Date.now(), Date.now())
    .run()
  await db
    .prepare(
      'INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?, ?, ?, 1, ?, ?)',
    )
    .bind('other', 'Other', 'other@example.com', Date.now(), Date.now())
    .run()
  const thumbnail = (version, init = {}) =>
    runtime.dispatchFetch(
      `https://test/files/${thumbnailFileId}/thumbnail?v=${version}`,
      {
        ...init,
        headers: { 'x-user': 'owner', ...init.headers },
      },
    )
  const upload = (version, body = 'drawing', headers = {}) =>
    thumbnail(version, { method: 'PUT', body, headers })
  assert.equal((await upload(0, 'drawing', { 'x-user': '' })).status, 401)
  assert.equal((await upload(0, 'drawing', { 'x-user': 'other' })).status, 404)
  assert.equal((await upload('invalid')).status, 400)
  const first = await (await upload(0)).json()
  assert.equal(first.hasThumbnail, true)
  assert.ok(first.thumbnailRevision)
  assert.equal(await (await thumbnail(0)).text(), 'drawing')
  const second = await (await upload(0, 'new drawing')).json()
  assert.notEqual(second.thumbnailRevision, first.thumbnailRevision)
  assert.equal(
    (
      await runtime.dispatchFetch(
        `https://test/files/${thumbnailFileId}/thumbnail?v=0&revision=${first.thumbnailRevision}`,
        { headers: { 'x-user': 'owner' } },
      )
    ).status,
    404,
  )
  const savedResponse = await runtime.dispatchFetch(
    'https://test/saveDocument',
    {
      method: 'POST',
      headers: { 'x-user': 'owner', 'content-type': 'application/json' },
      body: JSON.stringify({
        id: thumbnailFileId,
        baseVersion: 0,
        document: { store: {}, schema: {} },
      }),
    },
  )
  assert.equal(savedResponse.status, 200)
  const saved = await savedResponse.json()
  assert.equal(saved.version, 1)
  assert.equal(saved.hasThumbnail, false)
  assert.equal(saved.thumbnailRevision, null)
  assert.equal((await thumbnail(1)).status, 404)
  assert.equal((await thumbnail(0)).status, 404)
  assert.equal((await upload(0)).status, 409)
  assert.equal((await upload(1)).status, 200)
  assert.equal((await thumbnail(0, { method: 'DELETE' })).status, 409)
  assert.equal(
    (await (await call('get', 'owner', thumbnailFileId)).json()).hasThumbnail,
    true,
  )
  const cleared = await (await thumbnail(1, { method: 'DELETE' })).json()
  assert.deepEqual(cleared, {
    version: 1,
    hasThumbnail: false,
    thumbnailRevision: null,
  })
  assert.equal((await thumbnail(1)).status, 404)
  assert.equal(
    (await (await call('get', 'owner', thumbnailFileId)).json()).hasThumbnail,
    false,
  )
  assert.equal((await upload(1, 'stale', { 'x-race': 'save' })).status, 409)
  assert.equal(
    (await (await call('get', 'owner', thumbnailFileId)).json()).version,
    2,
  )
  assert.equal((await thumbnail(2)).status, 404)
  assert.equal(
    (await storage.list({ prefix: `files/${thumbnailFileId}/thumbnails/` }))
      .objects.length,
    0,
  )
  assert.equal((await upload(2, 'latest')).status, 200)
})

test('trash and permanent deletion preserve activity and isolate it by user', async () => {
  await db
    .prepare(
      'UPDATE user_settings SET last_edited_canvas_id = ? WHERE user_id = ?',
    )
    .bind(fileId, 'owner')
    .run()
  assert.equal((await call('destroy', 'other')).status, 400)
  assert.equal((await call('trash')).status, 200)
  assert.equal((await (await call('analytics')).json()).totalTokens, 42)
  assert.equal((await (await call('activity')).json())[0].available, false)
  const destroyed = await call('destroy')
  assert.equal(destroyed.status, 200, await destroyed.text())
  assert.equal(
    (
      await db
        .prepare(
          'SELECT last_edited_canvas_id FROM user_settings WHERE user_id = ?',
        )
        .bind('owner')
        .first()
    ).last_edited_canvas_id,
    null,
  )
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
  assert.equal(
    (await storage.list({ prefix: `files/${fileId}/thumbnails/` })).objects
      .length,
    0,
  )
  assert.ok(await storage.get(`files/${fileId}/chats/${chatId}/preview.jpg`))
})

test('bulk deletion validates the whole selection and deletes more than 100 canvases in one request', async () => {
  const ids = Array.from({ length: 105 }, () => crypto.randomUUID())
  const foreignId = crypto.randomUUID()
  await db.batch(
    [...ids, foreignId].map((id) =>
      db
        .prepare(
          'INSERT INTO files (id,owner_id,name,trashed_at,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          id === foreignId ? 'other' : 'owner',
          'Bulk canvas',
          Date.now(),
          Date.now(),
          Date.now(),
        ),
    ),
  )
  await db
    .prepare(
      'UPDATE user_settings SET last_edited_canvas_id = ? WHERE user_id = ?',
    )
    .bind(ids[0], 'owner')
    .run()
  await db
    .prepare(
      'INSERT INTO user_settings (user_id,last_edited_canvas_id,created_at,updated_at) VALUES (?, ?, ?, ?)',
    )
    .bind('other', ids[1], Date.now(), Date.now())
    .run()
  const destroy = (selected) =>
    runtime.dispatchFetch('https://test/destroy', {
      method: 'POST',
      headers: { 'x-user': 'owner', 'content-type': 'application/json' },
      body: JSON.stringify({ ids: selected }),
    })
  const exists = async (id) =>
    Boolean(
      await db.prepare('SELECT id FROM files WHERE id = ?').bind(id).first(),
    )
  assert.equal((await (await destroy([])).json()).code, 'BAD_REQUEST')
  assert.equal(
    (await (await destroy([ids[0], foreignId])).json()).code,
    'NOT_FOUND',
  )
  assert.equal(
    (await (await destroy([ids[0], crypto.randomUUID()])).json()).code,
    'NOT_FOUND',
  )
  assert.ok(await exists(ids[0]))
  assert.equal(
    (
      await db
        .prepare(
          'SELECT last_edited_canvas_id FROM user_settings WHERE user_id = ?',
        )
        .bind('owner')
        .first()
    ).last_edited_canvas_id,
    ids[0],
  )
  const runningChat = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO chats (id,file_id,user_id,title,status,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      runningChat,
      ids[1],
      'owner',
      'Running',
      'running',
      Date.now(),
      Date.now(),
    )
    .run()
  assert.equal((await (await destroy(ids)).json()).code, 'CONFLICT')
  assert.ok(await exists(ids[0]))
  assert.ok(await exists(ids[1]))
  await db
    .prepare('UPDATE chats SET status = ? WHERE id = ?')
    .bind('ready', runningChat)
    .run()
  for (const id of ids.slice(0, 2))
    await storage.put(`files/${id}/thumbnails/1/test`, 'preview')
  const response = await destroy([...ids, ids[0]])
  assert.equal(response.status, 200)
  assert.deepEqual(new Set((await response.json()).deleted), new Set(ids))
  for (const id of ids) assert.equal(await exists(id), false)
  assert.ok(await exists(foreignId))
  for (const user of ['owner', 'other'])
    assert.equal(
      (
        await db
          .prepare(
            'SELECT last_edited_canvas_id FROM user_settings WHERE user_id = ?',
          )
          .bind(user)
          .first()
      ).last_edited_canvas_id,
      null,
    )
  for (const id of ids.slice(0, 2))
    assert.equal(await storage.get(`files/${id}/thumbnails/1/test`), null)
  assert.ok(
    await db
      .prepare('SELECT id FROM chats WHERE id = ?')
      .bind(runningChat)
      .first(),
  )
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
