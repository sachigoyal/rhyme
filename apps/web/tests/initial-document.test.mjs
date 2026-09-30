import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let resolveInitialDocument
const document = { store: {}, schema: {} }

before(async () => {
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ resolveInitialDocument } = await server.ssrLoadModule(
    '/src/features/editor/initial-document.ts',
  ))
})
after(async () => server?.close())

test('an unavailable local store does not block a valid cloud document', async () => {
  const result = await resolveInitialDocument(
    'file',
    { document, version: 4 },
    async () => {
      throw new Error('IndexedDB unavailable')
    },
  )
  assert.deepEqual(result, {
    document,
    version: 4,
    dirty: false,
    offline: false,
  })
})

test('unsynced edits are resumed only on the matching cloud version', async () => {
  const localDocument = { ...document, store: { local: true } }
  const readLocal = async () => ({
    document: localDocument,
    baseVersion: 4,
    dirty: true,
  })
  const resumed = await resolveInitialDocument(
    'file',
    { document, version: 4 },
    readLocal,
  )
  assert.deepEqual(resumed, {
    document: localDocument,
    version: 4,
    dirty: true,
    offline: false,
  })
  const newer = await resolveInitialDocument(
    'file',
    { document, version: 5 },
    readLocal,
  )
  assert.deepEqual(newer, {
    document,
    version: 5,
    dirty: false,
    offline: false,
  })
})

test('offline opening uses the saved copy and missing copies resolve to retry state', async () => {
  assert.deepEqual(
    await resolveInitialDocument('file', undefined, async () => ({
      document,
      baseVersion: 2,
      dirty: true,
    })),
    { document, version: 2, dirty: true, offline: true },
  )
  assert.equal(
    await resolveInitialDocument('file', undefined, async () => undefined),
    null,
  )
  assert.equal(
    await resolveInitialDocument('file', undefined, async () => {
      throw new Error('No storage')
    }),
    null,
  )
})
