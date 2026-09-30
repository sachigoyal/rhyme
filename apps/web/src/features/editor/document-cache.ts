import { createStore, del, get, set } from 'idb-keyval'
import type { DocumentSnapshot } from '@rhyme/trpc-client'

export interface CachedDocument {
  baseVersion: number
  dirty: boolean
  document: DocumentSnapshot
}

const store =
  typeof indexedDB === 'undefined'
    ? undefined
    : createStore('rhyme', 'documents')

export const documentCache = {
  get: (fileId: string) => get<CachedDocument>(fileId, store),
  set: (fileId: string, entry: CachedDocument) => set(fileId, entry, store),
  delete: (fileId: string) => del(fileId, store),
}
