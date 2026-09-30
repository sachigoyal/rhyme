import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import {
  beginCacheTransaction,
  patchCache,
  refreshCacheTransaction,
  rollbackCacheTransaction,
  settleCacheTransaction,
  replaceFileInList,
} from '../src/cache.ts'

const key = ['files', 'test']
const filter = { queryKey: key, exact: true }
const invalidations = [{ scope: 'files', filter }]
const rename = (id, name) => ({
  filter,
  update: (rows) => rows.map((row) => (row.id === id ? { ...row, name } : row)),
})

function client(rows) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  queryClient.setQueryData(key, rows)
  return queryClient
}

test('an earlier failure preserves a later optimistic rename and its successful settlement', async () => {
  const queryClient = client([{ id: 'a', name: 'Original' }])
  const first = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'First')],
  )
  const second = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Second')],
  )
  await settleCacheTransaction(queryClient, second, invalidations)
  assert.equal(queryClient.getQueryState(key).isInvalidated, false)
  rollbackCacheTransaction(queryClient, first)
  assert.deepEqual(queryClient.getQueryData(key), [{ id: 'a', name: 'Second' }])
  await settleCacheTransaction(queryClient, first, invalidations)
  assert.equal(queryClient.getQueryState(key).isInvalidated, true)
  queryClient.clear()
})

test('a later failed mutation rolls back to an earlier successful value', async () => {
  const queryClient = client([{ id: 'a', name: 'Original' }])
  const first = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'First')],
  )
  const second = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Second')],
  )
  await settleCacheTransaction(queryClient, first, invalidations)
  rollbackCacheTransaction(queryClient, second)
  assert.deepEqual(queryClient.getQueryData(key), [{ id: 'a', name: 'First' }])
  await settleCacheTransaction(queryClient, second, invalidations)
  queryClient.clear()
})

test('a failed deletion restores its row without undoing another file rename', async () => {
  const queryClient = client([
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ])
  const deletion = await beginCacheTransaction(
    queryClient,
    ['files'],
    [{ filter, update: (rows) => rows.filter((row) => row.id !== 'a') }],
  )
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('b', 'New B')],
  )
  rollbackCacheTransaction(queryClient, deletion)
  assert.deepEqual(queryClient.getQueryData(key), [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'New B' },
  ])
  await settleCacheTransaction(queryClient, deletion, invalidations)
  await settleCacheTransaction(queryClient, change, invalidations)
  queryClient.clear()
})

test('background responses are rebased under optimistic changes and survive rollback', async () => {
  const queryClient = client([{ id: 'a', name: 'A' }])
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Optimistic')],
  )
  await queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => [{ id: 'a', name: 'Remote', version: 2 }],
  })
  assert.deepEqual(queryClient.getQueryData(key), [
    { id: 'a', name: 'Optimistic', version: 2 },
  ])
  rollbackCacheTransaction(queryClient, change)
  assert.deepEqual(queryClient.getQueryData(key), [
    { id: 'a', name: 'Remote', version: 2 },
  ])
  await settleCacheTransaction(queryClient, change, invalidations)
  queryClient.clear()
})

test('confirmed document metadata survives an unrelated failed rename', async () => {
  const queryClient = client([{ id: 'a', name: 'A', version: 1 }])
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Optimistic')],
  )
  patchCache(queryClient, {
    filter,
    update: (rows) => rows.map((row) => ({ ...row, version: 2 })),
  })
  rollbackCacheTransaction(queryClient, change)
  assert.deepEqual(queryClient.getQueryData(key), [
    { id: 'a', name: 'A', version: 2 },
  ])
  await settleCacheTransaction(queryClient, change, invalidations)
  queryClient.clear()
})

test('pending creations reconcile to server IDs without duplicated rows', async () => {
  const queryClient = client([])
  const created = { id: 'pending:1', name: 'New' }
  const create = await beginCacheTransaction(
    queryClient,
    ['files'],
    [
      {
        filter,
        update: (rows) => [
          ...rows.filter((row) => row.id !== created.id),
          { ...created },
        ],
      },
    ],
  )
  assert.equal(queryClient.getQueryData(key)[0].id, 'pending:1')
  created.id = 'server-id'
  refreshCacheTransaction(queryClient, create)
  assert.deepEqual(queryClient.getQueryData(key), [
    { id: 'server-id', name: 'New' },
  ])
  await settleCacheTransaction(queryClient, create, invalidations)
  queryClient.clear()
})

test('in-flight queries are cancelled before optimistic state is applied', async () => {
  const queryClient = client([{ id: 'a', name: 'A' }])
  let finish
  const fetching = queryClient
    .fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    .catch(() => undefined)
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Optimistic')],
  )
  finish([{ id: 'a', name: 'Old response' }])
  await fetching
  assert.equal(queryClient.getQueryData(key)[0].name, 'Optimistic')
  await settleCacheTransaction(queryClient, change, invalidations)
  queryClient.clear()
})

const listKey = (input) => [['files', 'list'], { input, type: 'query' }]
const file = {
  id: 'a',
  name: 'A',
  folderId: 'folder',
  role: 'owner',
  trashedAt: null,
  updatedAt: new Date('2026-09-30'),
}

test('move, trash, and restore respect aggregate, folder, shared, and trash list membership', () => {
  const root = listKey({ view: 'mine', folderId: null })
  const folder = listKey({ view: 'mine', folderId: 'folder' })
  const all = listKey({ view: 'mine' })
  const trash = listKey({ view: 'trash' })
  const shared = listKey({ view: 'shared' })
  assert.deepEqual(replaceFileInList([], file, all), [file])
  assert.deepEqual(replaceFileInList([], file, folder), [file])
  assert.deepEqual(replaceFileInList([], file, root), [])
  assert.deepEqual(replaceFileInList([], file, shared), [])
  const moved = { ...file, folderId: null }
  assert.deepEqual(replaceFileInList([file], moved, folder), [])
  assert.deepEqual(replaceFileInList([], moved, root), [moved])
  const trashed = { ...moved, trashedAt: new Date('2026-09-30') }
  assert.deepEqual(replaceFileInList([moved], trashed, root), [])
  assert.deepEqual(replaceFileInList([], trashed, trash), [trashed])
  assert.deepEqual(replaceFileInList([trashed], moved, trash), [])
  assert.deepEqual(replaceFileInList([], moved, root), [moved])
})

test('a failed move plus a later rename restores folder membership and keeps the rename in detail and lists', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  })
  const detailKey = [['files', 'get'], { input: { id: 'a' }, type: 'query' }]
  const rootKey = listKey({ view: 'mine', folderId: null })
  const folderKey = listKey({ view: 'mine', folderId: 'folder' })
  const original = { ...file, name: 'Original' }
  queryClient.setQueryData(detailKey, original)
  queryClient.setQueryData(rootKey, [])
  queryClient.setQueryData(folderKey, [original])
  const metadataChange = (update) => [
    { filter: { queryKey: detailKey, exact: true }, update },
    {
      filter: { queryKey: [['files', 'list']] },
      update: (rows, currentKey) =>
        replaceFileInList(
          rows,
          queryClient.getQueryData(detailKey),
          currentKey,
        ),
    },
  ]
  const move = await beginCacheTransaction(
    queryClient,
    ['files'],
    metadataChange((row) => ({ ...row, folderId: null })),
  )
  const rename = await beginCacheTransaction(
    queryClient,
    ['files'],
    metadataChange((row) => ({ ...row, name: 'Renamed' })),
  )
  await settleCacheTransaction(queryClient, rename, [])
  rollbackCacheTransaction(queryClient, move)
  assert.deepEqual(queryClient.getQueryData(detailKey), {
    ...original,
    name: 'Renamed',
  })
  assert.deepEqual(queryClient.getQueryData(rootKey), [])
  assert.deepEqual(queryClient.getQueryData(folderKey), [
    { ...original, name: 'Renamed' },
  ])
  await settleCacheTransaction(queryClient, move, [])
  queryClient.clear()
})

test('unrelated scopes invalidate immediately while shared scopes wait and coalesce refetches', async () => {
  const queryClient = client([{ id: 'a', name: 'A' }])
  const calls = []
  const invalidate = queryClient.invalidateQueries.bind(queryClient)
  queryClient.invalidateQueries = (filter) => {
    calls.push(filter)
    return invalidate(filter)
  }
  const first = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'First')],
  )
  const second = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Second')],
  )
  await settleCacheTransaction(queryClient, first, invalidations)
  await settleCacheTransaction(queryClient, undefined, [
    { scope: 'folders', filter: { queryKey: ['folders'] } },
  ])
  assert.deepEqual(
    calls.map((filter) => filter.queryKey),
    [['folders']],
  )
  await settleCacheTransaction(queryClient, second, invalidations)
  assert.deepEqual(
    calls.map((filter) => filter.queryKey),
    [['folders'], key],
  )
  queryClient.clear()
})

test('a list first fetched during a pending mutation receives its optimistic overlay', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  })
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Optimistic')],
  )
  await queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => [{ id: 'a', name: 'Remote' }],
  })
  assert.deepEqual(queryClient.getQueryData(key), [
    { id: 'a', name: 'Optimistic' },
  ])
  rollbackCacheTransaction(queryClient, change)
  assert.deepEqual(queryClient.getQueryData(key), [{ id: 'a', name: 'Remote' }])
  await settleCacheTransaction(queryClient, change, invalidations)
  queryClient.clear()
})

test('new matching query keys inherit pending updates without changing unrelated queries', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  })
  const lists = { queryKey: [['files', 'list']] }
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [
      {
        filter: lists,
        update: (rows) => rows.map((row) => ({ ...row, name: 'Optimistic' })),
      },
    ],
  )
  const newKey = listKey({ view: 'mine', folderId: 'new-folder' })
  await queryClient.fetchQuery({
    queryKey: newKey,
    queryFn: async () => [{ id: 'a', name: 'Remote' }],
  })
  await queryClient.fetchQuery({
    queryKey: ['folders'],
    queryFn: async () => [{ id: 'folder', name: 'Keep' }],
  })
  assert.deepEqual(queryClient.getQueryData(newKey), [
    { id: 'a', name: 'Optimistic' },
  ])
  assert.deepEqual(queryClient.getQueryData(['folders']), [
    { id: 'folder', name: 'Keep' },
  ])
  await settleCacheTransaction(queryClient, change, [])
  queryClient.clear()
})

test('clearing private query data prevents late rollback, reconciliation, and invalidation from reviving it', async () => {
  const queryClient = client([{ id: 'a', name: 'Private' }])
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Optimistic')],
  )
  queryClient.clear()
  queryClient.setQueryData(['session'], null)
  rollbackCacheTransaction(queryClient, change)
  refreshCacheTransaction(queryClient, change)
  await settleCacheTransaction(queryClient, change, invalidations)
  assert.equal(queryClient.getQueryData(key), undefined)
  assert.equal(queryClient.getQueryData(['session']), null)
  assert.equal(queryClient.getQueryCache().getAll().length, 1)
  queryClient.clear()
})

test('an authoritative null session cannot be resurrected by a failed profile update', async () => {
  const queryClient = client([])
  const sessionKey = ['session']
  queryClient.setQueryData(sessionKey, {
    user: { id: 'user', name: 'Original' },
  })
  const profile = await beginCacheTransaction(
    queryClient,
    ['profile'],
    [
      {
        filter: { queryKey: sessionKey, exact: true },
        update: (session) => ({
          ...session,
          user: { ...session.user, name: 'Optimistic' },
        }),
      },
    ],
  )
  queryClient.setQueryData(sessionKey, null)
  rollbackCacheTransaction(queryClient, profile)
  refreshCacheTransaction(queryClient, profile)
  await settleCacheTransaction(queryClient, profile, [
    { scope: 'profile', filter: { queryKey: sessionKey } },
  ])
  assert.equal(queryClient.getQueryData(sessionKey), null)
  queryClient.clear()
})

test('removing a file query prevents a pending transaction from recreating its detail on rollback', async () => {
  const queryClient = client([{ id: 'a', name: 'A' }])
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [rename('a', 'Optimistic')],
  )
  queryClient.setQueryData(['keep'], 'Other cache')
  queryClient.removeQueries(filter)
  rollbackCacheTransaction(queryClient, change)
  await settleCacheTransaction(queryClient, change, [])
  assert.equal(queryClient.getQueryData(key), undefined)
  assert.equal(queryClient.getQueryData(['keep']), 'Other cache')
  queryClient.clear()
})

test('a folder deletion rehomes a file when its earlier optimistic move fails', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  })
  const detailKey = [['files', 'get'], { input: { id: 'a' }, type: 'query' }]
  const rootKey = listKey({ view: 'mine', folderId: null })
  const originalFolder = listKey({ view: 'mine', folderId: 'folder' })
  const destination = listKey({ view: 'mine', folderId: 'other' })
  queryClient.setQueryData(detailKey, file)
  queryClient.setQueryData(rootKey, [])
  queryClient.setQueryData(originalFolder, [file])
  queryClient.setQueryData(destination, [])
  const detailFilter = { queryKey: detailKey, exact: true }
  const lists = { queryKey: [['files', 'list']] }
  const syncLists = {
    filter: lists,
    update: (rows, currentKey) =>
      replaceFileInList(rows, queryClient.getQueryData(detailKey), currentKey),
  }
  const move = await beginCacheTransaction(
    queryClient,
    ['files'],
    [
      {
        filter: detailFilter,
        update: (row) => ({ ...row, folderId: 'other' }),
      },
      syncLists,
    ],
  )
  const deletion = await beginCacheTransaction(
    queryClient,
    ['files', 'folders'],
    [
      {
        filter: detailFilter,
        update: (row) =>
          row.folderId === 'folder' ? { ...row, folderId: null } : row,
      },
      syncLists,
    ],
  )
  await settleCacheTransaction(queryClient, deletion, [])
  rollbackCacheTransaction(queryClient, move)
  assert.deepEqual(queryClient.getQueryData(detailKey), {
    ...file,
    folderId: null,
  })
  assert.deepEqual(queryClient.getQueryData(rootKey), [
    { ...file, folderId: null },
  ])
  assert.deepEqual(queryClient.getQueryData(originalFolder), [])
  assert.deepEqual(queryClient.getQueryData(destination), [])
  await settleCacheTransaction(queryClient, move, [])
  queryClient.clear()
})

test('a query completing during cancellation receives each optimistic layer only once', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  })
  const cancel = queryClient.cancelQueries.bind(queryClient)
  queryClient.cancelQueries = async (filter) => {
    await cancel(filter)
    await queryClient.fetchQuery({ queryKey: key, queryFn: async () => 0 })
  }
  const change = await beginCacheTransaction(
    queryClient,
    ['files'],
    [{ filter, update: (count) => count + 1 }],
  )
  assert.equal(queryClient.getQueryData(key), 1)
  rollbackCacheTransaction(queryClient, change)
  assert.equal(queryClient.getQueryData(key), 0)
  await settleCacheTransaction(queryClient, change, [])
  queryClient.clear()
})

test('independent preference updates preserve each other when one request fails', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  const settingsKey = ['settings']
  const settingsFilter = { queryKey: settingsKey, exact: true }
  queryClient.setQueryData(settingsKey, {
    showGrid: false,
    snapToShapes: false,
    theme: 'system',
  })
  const patch = (changes) => ({
    filter: settingsFilter,
    update: (data) => ({ ...data, ...changes }),
  })
  const grid = await beginCacheTransaction(
    queryClient,
    ['settings'],
    [patch({ showGrid: true })],
  )
  const snap = await beginCacheTransaction(
    queryClient,
    ['settings'],
    [patch({ snapToShapes: true })],
  )
  assert.deepEqual(queryClient.getQueryData(settingsKey), {
    showGrid: true,
    snapToShapes: true,
    theme: 'system',
  })
  rollbackCacheTransaction(queryClient, grid)
  assert.deepEqual(queryClient.getQueryData(settingsKey), {
    showGrid: false,
    snapToShapes: true,
    theme: 'system',
  })
  const changed = [{ scope: 'settings', filter: settingsFilter }]
  await settleCacheTransaction(queryClient, grid, changed)
  assert.equal(queryClient.getQueryState(settingsKey).isInvalidated, false)
  await settleCacheTransaction(queryClient, snap, changed)
  assert.equal(queryClient.getQueryState(settingsKey).isInvalidated, true)
})
