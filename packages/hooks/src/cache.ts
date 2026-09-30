import { hashKey, matchQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryFilters, QueryKey } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { FileSummary, FilesListInput } from '@rhyme/trpc-client'

type Update = (data: unknown, key: QueryKey) => unknown
export type CacheUpdate = { filter: QueryFilters; update: Update }
export type CacheInvalidation = { scope: string; filter: QueryFilters }
type Layer = { transaction: CacheTransaction; update: Update }
type Entry = { key: QueryKey; base: unknown; layers: Layer[] }
type CacheState = {
  entries: Map<string, Entry>
  pending: Map<string, number>
  invalidations: CacheInvalidation[]
  writing: boolean
  transactions: Set<CacheTransaction>
}
export type CacheTransaction = {
  scopes: string[]
  entries: Set<Entry>
  settled: boolean
  failed: boolean
  updates: CacheUpdate[]
  discarded: boolean
}
const states = new WeakMap<QueryClient, CacheState>()

function discardTransactions(state: CacheState) {
  const transactions = new Set([
    ...state.transactions,
    ...[...state.entries.values()].flatMap((entry) =>
      entry.layers.map((layer) => layer.transaction),
    ),
  ])
  for (const transaction of transactions) {
    transaction.discarded = true
    transaction.entries.clear()
  }
  state.entries.clear()
  state.transactions.clear()
  state.pending.clear()
  state.invalidations = []
}

function render(queryClient: QueryClient, state: CacheState, entry: Entry) {
  if (state.entries.get(hashKey(entry.key)) !== entry) return
  const data = entry.layers.reduce(
    (value, layer) => layer.update(value, entry.key),
    entry.base,
  )
  state.writing = true
  try {
    queryClient.setQueryData(entry.key, data)
  } finally {
    state.writing = false
  }
}

function getState(queryClient: QueryClient) {
  let state = states.get(queryClient)
  if (state) return state
  state = {
    entries: new Map(),
    pending: new Map(),
    invalidations: [],
    writing: false,
    transactions: new Set(),
  }
  states.set(queryClient, state)
  const current = state
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'removed') {
      const entry = current.entries.get(event.query.queryHash)
      if (entry) {
        for (const layer of entry.layers)
          layer.transaction.entries.delete(entry)
        current.entries.delete(event.query.queryHash)
      }
      if (!queryClient.getQueryCache().getAll().length)
        discardTransactions(current)
      return
    }
    if (
      !current.writing &&
      event.type === 'updated' &&
      event.action.type === 'success' &&
      event.query.queryKey.length === 1 &&
      event.query.queryKey[0] === 'session' &&
      event.query.state.data === null
    ) {
      discardTransactions(current)
      return
    }
    if (
      current.writing ||
      event.type !== 'updated' ||
      event.action.type !== 'success' ||
      event.action.manual
    )
      return
    let entry = current.entries.get(event.query.queryHash)
    for (const transaction of current.transactions) {
      if (transaction.failed || transaction.settled) continue
      for (const { filter, update } of transaction.updates) {
        if (!matchQuery(filter, event.query)) continue
        if (!entry) {
          entry = {
            key: event.query.queryKey,
            base: event.query.state.data,
            layers: [],
          }
          current.entries.set(event.query.queryHash, entry)
        }
        if (
          !entry.layers.some(
            (layer) =>
              layer.transaction === transaction && layer.update === update,
          )
        ) {
          entry.layers.push({ transaction, update })
          transaction.entries.add(entry)
        }
      }
    }
    if (!entry) return
    entry.base = event.query.state.data
    for (const active of current.entries.values())
      render(queryClient, current, active)
  })
  return state
}

export async function beginCacheTransaction(
  queryClient: QueryClient,
  scopes: string[],
  updates: CacheUpdate[],
) {
  const state = getState(queryClient)
  const transaction: CacheTransaction = {
    scopes: [...new Set(scopes)],
    entries: new Set(),
    settled: false,
    failed: false,
    updates,
    discarded: false,
  }
  state.transactions.add(transaction)
  for (const scope of transaction.scopes) {
    state.pending.set(scope, (state.pending.get(scope) ?? 0) + 1)
  }
  await Promise.all(
    updates.map(({ filter }) => queryClient.cancelQueries(filter)),
  )
  if (transaction.discarded) return transaction
  for (const { filter, update } of updates) {
    for (const [key, data] of queryClient.getQueriesData(filter)) {
      if (data === undefined) continue
      const hash = hashKey(key)
      let entry = state.entries.get(hash)
      if (!entry) {
        entry = { key, base: data, layers: [] }
        state.entries.set(hash, entry)
      }
      if (
        !entry.layers.some(
          (layer) =>
            layer.transaction === transaction && layer.update === update,
        )
      ) {
        entry.layers.push({ transaction, update })
        transaction.entries.add(entry)
      }
      render(queryClient, state, entry)
    }
  }
  return transaction
}

export function refreshCacheTransaction(
  queryClient: QueryClient,
  transaction?: CacheTransaction,
) {
  if (!transaction || transaction.discarded) return
  const state = getState(queryClient)
  for (const entry of transaction.entries) render(queryClient, state, entry)
}

export function rollbackCacheTransaction(
  queryClient: QueryClient,
  transaction?: CacheTransaction,
) {
  if (!transaction || transaction.failed || transaction.discarded) return
  transaction.failed = true
  const state = getState(queryClient)
  for (const entry of transaction.entries) {
    entry.layers = entry.layers.filter(
      (layer) => layer.transaction !== transaction,
    )
    render(queryClient, state, entry)
  }
}

export async function settleCacheTransaction(
  queryClient: QueryClient,
  transaction: CacheTransaction | undefined,
  invalidations: CacheInvalidation[],
) {
  if (transaction?.discarded) return
  const state = getState(queryClient)
  if (transaction && !transaction.settled) {
    transaction.settled = true
    state.transactions.delete(transaction)
    for (const entry of transaction.entries) {
      if (entry.layers.every((layer) => layer.transaction.settled)) {
        state.entries.delete(hashKey(entry.key))
      }
    }
    for (const scope of transaction.scopes) {
      const pending = (state.pending.get(scope) ?? 1) - 1
      if (pending) state.pending.set(scope, pending)
      else state.pending.delete(scope)
    }
  }
  state.invalidations.push(...invalidations)
  const ready = state.invalidations.filter(
    ({ scope }) => !state.pending.has(scope),
  )
  state.invalidations = state.invalidations.filter(({ scope }) =>
    state.pending.has(scope),
  )
  const unique = new Map(
    ready.map(({ filter }) => [hashKey(filter.queryKey ?? []), filter]),
  )
  void Promise.allSettled(
    [...unique.values()].map((filter) => queryClient.invalidateQueries(filter)),
  )
}

export function readCacheBase<T>(
  queryClient: QueryClient,
  key: QueryKey,
): T | undefined {
  const entry = getState(queryClient).entries.get(hashKey(key))
  return (entry ? entry.base : queryClient.getQueryData(key)) as T | undefined
}

export function patchCache(
  queryClient: QueryClient,
  { filter, update }: CacheUpdate,
) {
  const state = getState(queryClient)
  for (const [key, data] of queryClient.getQueriesData(filter)) {
    const entry = state.entries.get(hashKey(key))
    if (entry) {
      entry.base = update(entry.base, key)
      render(queryClient, state, entry)
    } else queryClient.setQueryData(key, update(data, key))
  }
}

export function useOptimisticCache() {
  const queryClient = useQueryClient()
  return {
    begin: (scopes: string[], updates: CacheUpdate[]) =>
      beginCacheTransaction(queryClient, scopes, updates),
    refresh: (transaction?: CacheTransaction) =>
      refreshCacheTransaction(queryClient, transaction),
    rollback: (transaction?: CacheTransaction) =>
      rollbackCacheTransaction(queryClient, transaction),
    settle: (
      transaction: CacheTransaction | undefined,
      invalidations: CacheInvalidation[],
    ) => settleCacheTransaction(queryClient, transaction, invalidations),
    patch: (update: CacheUpdate) => patchCache(queryClient, update),
  }
}

export function queryInput<T>(key: QueryKey): T | undefined {
  return (key[1] as { input?: T } | undefined)?.input
}

export function fileBelongsToList(
  file: FileSummary,
  input: FilesListInput = {},
) {
  switch (input.view ?? 'mine') {
    case 'trash':
      return file.role === 'owner' && file.trashedAt !== null
    case 'shared':
      return file.role !== 'owner' && file.trashedAt === null
    default:
      return (
        file.role === 'owner' &&
        file.trashedAt === null &&
        (input.folderId === undefined || file.folderId === input.folderId)
      )
  }
}

export function sortFiles(files: FileSummary[], input: FilesListInput = {}) {
  return [...files].sort((a, b) =>
    input.view === 'trash'
      ? b.trashedAt!.getTime() - a.trashedAt!.getTime()
      : b.updatedAt.getTime() - a.updatedAt.getTime(),
  )
}

export function replaceFileInList(
  files: FileSummary[],
  file: FileSummary,
  key: QueryKey,
  previousId = file.id,
) {
  const input = queryInput<FilesListInput>(key)
  const remaining = files.filter(
    (row) => row.id !== previousId && row.id !== file.id,
  )
  return sortFiles(
    fileBelongsToList(file, input) ? [...remaining, file] : remaining,
    input,
  )
}

export function useFilesCache() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useOptimisticCache()
  const lists = trpc.files.list.queryFilter()
  return {
    ...cache,
    lists,
    find: (id: string) =>
      queryClient.getQueryData(trpc.files.get.queryKey({ id })) ??
      queryClient
        .getQueriesData<FileSummary[]>(lists)
        .flatMap(([, rows]) => rows ?? [])
        .find((row) => row.id === id),
    listUpdate: (
      update: (rows: FileSummary[], key: QueryKey) => FileSummary[],
    ): CacheUpdate => ({
      filter: lists,
      update: (rows, key) => rows && update(rows as FileSummary[], key),
    }),
    detailUpdate: (
      id: string,
      update: (file: FileSummary) => FileSummary,
    ): CacheUpdate => ({
      filter: trpc.files.get.queryFilter({ id }),
      update: (file) => file && update(file as FileSummary),
    }),
    listInvalidation: { scope: 'files', filter: lists },
    fileInvalidation: (id: string): CacheInvalidation => ({
      scope: 'files',
      filter: trpc.files.get.queryFilter({ id }),
    }),
  }
}

export type CachedSession = {
  user: { id: string; name: string; email: string }
}
export function sessionUser(queryClient: QueryClient) {
  return queryClient.getQueryData<CachedSession>(['session'])?.user
}
export const pendingId = () => `pending:${crypto.randomUUID()}`
