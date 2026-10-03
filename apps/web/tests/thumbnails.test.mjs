import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { createServer } from 'vite'

let server, createThumbnailer, DocumentSync, thumbnailUrl
const originalFetch = globalThis.fetch

before(async () => {
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    appType: 'custom',
    resolve: { alias: { '@': new URL('../src', import.meta.url).pathname } },
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ createThumbnailer } = await server.ssrLoadModule(
    '/src/features/editor/assets.ts',
  ))
  ;({ DocumentSync } = await server.ssrLoadModule(
    '/src/features/editor/document-sync.ts',
  ))
  ;({ thumbnailUrl } = await server.ssrLoadModule('/src/lib/storage.ts'))
})
after(async () => {
  globalThis.fetch = originalFetch
  await server?.close()
})

function deferred() {
  let resolve
  const promise = new Promise((done) => (resolve = done))
  return { promise, resolve }
}

function fixture(empty = false) {
  const sync = {
    version: 1,
    revision: 1,
    status: 'saved',
    getVersion: () => sync.version,
    getRevision: () => sync.revision,
    getStatus: () => sync.status,
    flush: async () => {},
  }
  const editor = {
    getCurrentPageShapeIds: () => new Set(empty ? [] : ['shape:sketch']),
    getCurrentPageBounds: () => (empty ? null : { w: 1600, h: 800 }),
    toImage: async (_shapes, options) => {
      assert.equal(options.scale, 0.5)
      return { blob: new Blob(['drawing'], { type: 'image/png' }) }
    },
  }
  const requests = []
  const published = []
  globalThis.fetch = async (url, init) => {
    requests.push({ url: new URL(url), ...init })
    return Response.json({
      version: Number(new URL(url).searchParams.get('v')),
      hasThumbnail: init.method === 'PUT',
      thumbnailRevision:
        init.method === 'PUT' ? `image-${requests.length}` : null,
    })
  }
  const thumbnailer = createThumbnailer('canvas', sync, (value) =>
    published.push(value),
  )
  return { sync, editor, requests, published, thumbnailer }
}

test('empty canvases clear stored previews and publish the blank state', async () => {
  const { editor, requests, published, thumbnailer } = fixture(true)
  await thumbnailer.flush(editor)
  assert.equal(requests[0].method, 'DELETE')
  assert.equal(requests[0].url.searchParams.get('v'), '1')
  assert.deepEqual(published, [
    { version: 1, hasThumbnail: false, thumbnailRevision: null },
  ])
})

test('exit capture waits for the document save before publishing its version', async () => {
  const { sync, editor, requests, published, thumbnailer } = fixture()
  const saving = deferred()
  sync.status = 'saving'
  sync.flush = () => saving.promise
  const captured = thumbnailer.flush(editor)
  await setImmediate()
  assert.equal(requests.length, 0)
  sync.version = 2
  sync.status = 'saved'
  saving.resolve()
  await captured
  assert.equal(requests[0].url.searchParams.get('v'), '2')
  assert.equal(published[0].version, 2)
})

test('edits during rendering discard the obsolete capture', async () => {
  const { sync, editor, requests, thumbnailer } = fixture()
  const image = deferred()
  editor.toImage = () => image.promise
  const captured = thumbnailer.flush(editor)
  sync.revision++
  image.resolve({ blob: new Blob(['old drawing']) })
  await captured
  assert.equal(requests.length, 0)
})

test('uploads serialize and an old completion cannot restore a stale preview', async () => {
  const { sync, editor, published, thumbnailer } = fixture()
  const first = deferred()
  const versions = []
  globalThis.fetch = async (url) => {
    const version = Number(new URL(url).searchParams.get('v'))
    versions.push(version)
    if (version === 1) return first.promise
    return Response.json({
      version,
      hasThumbnail: true,
      thumbnailRevision: 'new',
    })
  }
  const oldCapture = thumbnailer.flush(editor)
  await setImmediate()
  sync.version++
  sync.revision++
  const newCapture = thumbnailer.flush(editor)
  await setImmediate()
  assert.deepEqual(versions, [1])
  first.resolve(
    Response.json({ version: 1, hasThumbnail: true, thumbnailRevision: 'old' }),
  )
  await Promise.all([oldCapture, newCapture])
  assert.deepEqual(versions, [1, 2])
  assert.deepEqual(published, [
    { version: 2, hasThumbnail: true, thumbnailRevision: 'new' },
  ])
})

test('failed publication does not block later captures', async (t) => {
  const { editor, published, thumbnailer } = fixture()
  t.mock.method(console, 'warn', () => {})
  globalThis.fetch = async () => new Response(null, { status: 500 })
  await thumbnailer.flush(editor)
  assert.equal(published.length, 0)
  globalThis.fetch = async () =>
    Response.json({
      version: 1,
      hasThumbnail: true,
      thumbnailRevision: 'retry',
    })
  await thumbnailer.flush(editor)
  assert.equal(published[0].thumbnailRevision, 'retry')
})

test('scheduled captures throttle to 15 seconds and exit flush bypasses the timer', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 20_000 })
  const { editor, requests, thumbnailer } = fixture()
  thumbnailer.schedule(editor)
  t.mock.timers.tick(0)
  await setImmediate()
  assert.equal(requests.length, 1)
  thumbnailer.schedule(editor)
  t.mock.timers.tick(14_999)
  await setImmediate()
  assert.equal(requests.length, 1)
  await thumbnailer.flush(editor)
  assert.equal(requests.length, 2)
  t.mock.timers.tick(1)
  await setImmediate()
  assert.equal(requests.length, 2)
})

test('preview URLs change on publication even within the same document version', () => {
  assert.notEqual(
    thumbnailUrl('canvas', 1, 'first'),
    thumbnailUrl('canvas', 1, 'second'),
  )
})

test('flush waits for an active save and drains edits made during that save', async () => {
  const first = deferred()
  const second = deferred()
  const saves = []
  const sync = new DocumentSync({
    fileId: 'canvas',
    version: 0,
    dirty: true,
    save: (input) => {
      saves.push(input)
      return saves.length === 1 ? first.promise : second.promise
    },
    fetchVersion: async () => 0,
  })
  let document = { store: { first: {} }, schema: {} }
  sync.read = () => document
  sync.writeCache = async () => {}
  const active = sync.flush()
  document = { store: { latest: {} }, schema: {} }
  sync.onChange()
  const draining = sync.flush()
  first.resolve({ version: 1 })
  await active
  await setImmediate()
  assert.equal(saves.length, 2)
  assert.equal(saves[1].baseVersion, 1)
  assert.deepEqual(saves[1].document, document)
  second.resolve({ version: 2 })
  await draining
  assert.equal(sync.getStatus(), 'saved')
  assert.equal(sync.getVersion(), 2)
})

test('nested agent batches keep local recovery current and save once on finalization', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 20_000 })
  const saves = []
  let cached = 0
  let document = { store: {}, schema: {} }
  const sync = new DocumentSync({
    fileId: 'canvas',
    version: 0,
    dirty: false,
    save: async (input) => {
      saves.push(input)
      return { version: saves.length }
    },
    fetchVersion: async () => 0,
  })
  sync.read = () => document
  sync.writeCache = async () => {
    cached++
  }
  const endTurn = sync.beginBatch()
  const endTool = sync.beginBatch()
  for (let index = 1; index <= 20; index++) {
    document = { store: { count: index }, schema: {} }
    sync.onChange()
    t.mock.timers.tick(400)
    await setImmediate()
  }
  await sync.flush()
  assert.equal(saves.length, 0)
  assert.ok(cached > 0)
  endTool()
  t.mock.timers.tick(1000)
  await setImmediate()
  assert.equal(saves.length, 0)
  endTurn()
  t.mock.timers.tick(800)
  await setImmediate()
  assert.equal(saves.length, 1)
  assert.deepEqual(saves[0].document, document)
  assert.equal(sync.getStatus(), 'saved')
  endTurn()
  endTool()
  t.mock.timers.tick(5000)
  await setImmediate()
  assert.equal(saves.length, 1)
})

test('a save already in flight cannot schedule more writes during an agent batch', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 20_000 })
  const active = deferred()
  const saves = []
  const sync = new DocumentSync({
    fileId: 'canvas',
    version: 0,
    dirty: true,
    save: async (input) => {
      saves.push(input)
      return saves.length === 1 ? active.promise : { version: 2 }
    },
    fetchVersion: async () => 0,
  })
  sync.read = () => ({ store: {}, schema: {} })
  sync.writeCache = async () => {}
  const saving = sync.flush()
  const finalize = sync.beginBatch()
  sync.onChange()
  active.resolve({ version: 1 })
  await saving
  t.mock.timers.tick(10_000)
  await setImmediate()
  assert.equal(saves.length, 1)
  finalize()
  t.mock.timers.tick(800)
  await setImmediate()
  assert.equal(saves.length, 2)
  assert.equal(saves[1].baseVersion, 1)
  assert.equal(sync.getStatus(), 'saved')
})
