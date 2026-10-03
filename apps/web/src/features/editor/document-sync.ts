import { getSnapshot } from 'tldraw'
import type { Editor } from 'tldraw'
import { errorCode } from '@rhyme/trpc-client'
import type { DocumentSnapshot } from '@rhyme/trpc-client'
import { documentCache } from './document-cache'
import { registerEditorBatch } from './editor-batch'

export type SyncStatus =
  | 'saved'
  | 'unsaved'
  | 'saving'
  | 'offline'
  | 'error'
  | 'conflict'

interface DocumentSyncOptions {
  fileId: string
  version: number
  dirty: boolean
  save: (input: {
    id: string
    baseVersion: number
    document: DocumentSnapshot
  }) => Promise<{ version: number }>
  fetchVersion: () => Promise<number>
  onSaved?: () => void
}

const SAVE_DELAY = 800
const MAX_SAVE_DELAY = 4_000
const RETRY_DELAY = 5_000
const CACHE_DELAY = 250

// Mirrors the canvas into IndexedDB immediately and into the API with optimistic versioning.
export class DocumentSync {
  private status: SyncStatus
  private version: number
  private revision: number
  private savedRevision = 0
  private pendingSince: number | null = null
  private saving: Promise<void> | null = null
  private saveTimer?: ReturnType<typeof setTimeout>
  private cacheTimer?: ReturnType<typeof setTimeout>
  private read: () => DocumentSnapshot | null = () => null
  private readonly listeners = new Set<() => void>()
  private readonly batches = new Set<symbol>()

  constructor(private readonly options: DocumentSyncOptions) {
    this.version = options.version
    this.revision = options.dirty ? 1 : 0
    this.status = options.dirty ? 'unsaved' : 'saved'
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  getStatus = () => this.status
  getVersion = () => this.version
  getRevision = () => this.revision

  beginBatch = () => {
    const batch = Symbol()
    this.batches.add(batch)
    clearTimeout(this.saveTimer)
    return () => {
      if (!this.batches.delete(batch) || this.batches.size) return
      if (this.isDirty && this.status !== 'conflict') this.schedule(0)
    }
  }

  attach(editor: Editor) {
    const unregisterBatch = registerEditorBatch(editor, this.beginBatch)
    this.read = () =>
      getSnapshot(editor.store).document as unknown as DocumentSnapshot

    const stopListening = editor.store.listen(() => this.onChange(), {
      source: 'user',
      scope: 'document',
    })
    const onOnline = () => void this.flush()
    const onHidden = () =>
      document.visibilityState === 'hidden' && void this.flush()
    const onUnload = (event: BeforeUnloadEvent) => {
      if (this.isDirty) event.preventDefault()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('visibilitychange', onHidden)
    if (this.isDirty) this.schedule(0)

    return () => {
      unregisterBatch()
      stopListening()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('visibilitychange', onHidden)
      clearTimeout(this.cacheTimer)

      const final = this.read()
      this.read = () => final
      this.batches.clear()
      void this.writeCache()
      void this.flush()
    }
  }

  async flush(): Promise<void> {
    clearTimeout(this.saveTimer)
    if (this.batches.size) return
    if (this.saving) {
      await this.saving
      if (this.status === 'unsaved') await this.flush()
      return
    }
    if (!this.isDirty || this.status === 'conflict') return

    const document = this.read()
    if (!document) return

    const revision = this.revision
    this.pendingSince = null
    this.setStatus('saving')

    this.saving = this.options
      .save({ id: this.options.fileId, baseVersion: this.version, document })
      .then(
        ({ version }) => {
          this.version = version
          this.savedRevision = revision
          this.setStatus(this.isDirty ? 'unsaved' : 'saved')
          this.options.onSaved?.()
        },
        (error: unknown) => {
          if (errorCode(error) === 'CONFLICT') this.setStatus('conflict')
          else this.setStatus(navigator.onLine ? 'error' : 'offline')
        },
      )
      .finally(() => {
        this.saving = null
        void this.writeCache()
        if (this.isDirty && this.status !== 'conflict' && !this.batches.size) {
          this.schedule(this.status === 'unsaved' ? SAVE_DELAY : RETRY_DELAY)
        }
      })

    return this.saving
  }

  // Overwrites whatever is on the server with the local canvas.
  async keepLocal() {
    this.version = await this.options.fetchVersion()
    this.revision++
    this.setStatus('unsaved')
    await this.flush()
  }

  private get isDirty() {
    return this.revision !== this.savedRevision
  }

  private onChange() {
    this.revision++
    this.pendingSince ??= Date.now()
    if (this.status === 'saved') this.setStatus('unsaved')

    clearTimeout(this.cacheTimer)
    this.cacheTimer = setTimeout(() => void this.writeCache(), CACHE_DELAY)
    if (this.batches.size) return
    this.schedule(
      Math.min(SAVE_DELAY, MAX_SAVE_DELAY - (Date.now() - this.pendingSince)),
    )
  }

  private schedule(delay: number) {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.flush(), Math.max(0, delay))
  }

  private async writeCache() {
    const document = this.read()
    if (!document) return
    await documentCache.set(this.options.fileId, {
      baseVersion: this.version,
      dirty: this.isDirty,
      document,
    })
  }

  private setStatus(status: SyncStatus) {
    if (this.status === status) return
    this.status = status
    for (const listener of this.listeners) listener()
  }
}
