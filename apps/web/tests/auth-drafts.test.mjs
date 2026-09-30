import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let server, guestDraft, onboardingDraft, lastEditedCanvas
const storage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}
const document = {
  store: {
    'page:one': { id: 'page:one', typeName: 'page' },
    'asset:image': { props: { src: 'data:image/png;base64,example' } },
  },
  schema: {},
}
before(async () => {
  globalThis.localStorage = storage()
  globalThis.sessionStorage = storage()
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ guestDraft } = await server.ssrLoadModule(
    '/src/features/auth/guest-draft.ts',
  ))
  ;({ lastEditedCanvas } = await server.ssrLoadModule(
    '/src/features/auth/home-destination.ts',
  ))
  ;({ onboardingDraft } = await server.ssrLoadModule(
    '/src/features/auth/onboarding-draft.ts',
  ))
})
after(async () => {
  await server?.close()
  delete globalThis.localStorage
  delete globalThis.sessionStorage
})
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('guest drawings and inline media survive a session and migrate from the old storage', () => {
  sessionStorage.setItem('rhyme:signup-draft', JSON.stringify({ document }))
  const migrated = guestDraft.get()
  assert.deepEqual(migrated.document, document)
  assert.equal(sessionStorage.getItem('rhyme:signup-draft'), null)
  assert.ok(localStorage.getItem('rhyme:signup-draft'))
  sessionStorage.clear()
  assert.equal(guestDraft.get().id, migrated.id)
  assert.deepEqual(guestDraft.get().document, document)
})

test('interrupted imports retain their identifier and cannot switch accounts', () => {
  guestDraft.set(document)
  const claimed = guestDraft.claim('first-user')
  assert.equal(
    guestDraft.claim('first-user').import.fileId,
    claimed.import.fileId,
  )
  assert.throws(() => guestDraft.claim('other-user'), /account/)
  guestDraft.clear('outdated-draft')
  assert.ok(guestDraft.get())
  guestDraft.clear(claimed.id)
  assert.equal(guestDraft.get(), null)
})

test('a newer guest drawing is not removed by completion of an older import', () => {
  guestDraft.set(document)
  const original = guestDraft.claim('user')
  const newer = guestDraft.set({ ...document, store: { updated: true } })
  assert.notEqual(newer.id, original.id)
  guestDraft.clear(original.id)
  assert.deepEqual(guestDraft.get().document.store, { updated: true })
})

test('onboarding restores answers and the active question for the matching account', () => {
  const draft = onboardingDraft.get('user', 'Example')
  draft.step = 'teamSize'
  draft.answers.role = 'engineering'
  draft.answers.useCases = ['diagrams', 'planning']
  onboardingDraft.set('user', draft)
  assert.deepEqual(onboardingDraft.get('user', 'Renamed'), draft)
  assert.equal(onboardingDraft.get('another-user', 'Someone else').step, 'name')
  onboardingDraft.clear('user')
  assert.equal(onboardingDraft.get('user', 'Example').step, 'name')
})

test('invalid saved state safely starts onboarding again', () => {
  localStorage.setItem('rhyme:onboarding:user', '{broken')
  assert.equal(onboardingDraft.get('user', 'Example').step, 'name')
  localStorage.setItem('rhyme:signup-draft', '{broken')
  assert.equal(guestDraft.get(), null)
})

test('home opens only an accessible canvas edited by this user and falls back when none exists', () => {
  const base = {
    role: 'owner',
    trashedAt: null,
    lastEditedById: 'me',
    updatedAt: new Date(1),
  }
  const files = [
    { ...base, id: 'older' },
    { ...base, id: 'recent', role: 'editor', updatedAt: new Date(5) },
    { ...base, id: 'viewer', role: 'viewer', updatedAt: new Date(9) },
    { ...base, id: 'trash', trashedAt: new Date(), updatedAt: new Date(10) },
    {
      ...base,
      id: 'someone-else',
      lastEditedById: 'other',
      updatedAt: new Date(11),
    },
    { ...base, id: 'pending:temporary', updatedAt: new Date(12) },
  ]
  assert.equal(lastEditedCanvas(files, 'me'), 'recent')
  assert.equal(lastEditedCanvas(files, 'nobody'), undefined)
  assert.equal(lastEditedCanvas([], 'me'), undefined)
})
