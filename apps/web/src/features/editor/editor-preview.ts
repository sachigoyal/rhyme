import { getSnapshot } from 'tldraw'
import type { Editor, TLRecord } from 'tldraw'

type TLRecordId = TLRecord['id']

type Change = { before?: TLRecord; after?: TLRecord }
const previews = new WeakMap<Editor, Map<TLRecordId, Change>>()
const clearers = new WeakMap<Editor, () => void>()
const versions = new WeakMap<Editor, number>()

export const hasEditorPreview = (editor: Editor) =>
  Boolean(previews.get(editor)?.size)
export const getEditorPreviewVersion = (editor: Editor) =>
  versions.get(editor) ?? 0

export function clearEditorPreview(editor: Editor) {
  clearers.get(editor)?.()
}

export function getDocumentSnapshot(editor: Editor) {
  const snapshot = getSnapshot(editor.store).document
  const changes = previews.get(editor)
  if (!changes?.size) return snapshot
  const store = { ...snapshot.store }
  for (const [id, change] of changes) {
    if (editor.store.get(id) !== change.after) continue
    if (change.before) store[id] = change.before
    else delete store[id]
  }
  return { ...snapshot, store }
}

export function createEditorPreview(editor: Editor) {
  const changes = new Map<TLRecordId, Change>()
  const clear = () => {
    if (changes.size) versions.set(editor, getEditorPreviewVersion(editor) + 1)
    previews.delete(editor)
    clearers.delete(editor)
    if (!editor.isDisposed && changes.size) {
      editor.run(
        () =>
          editor.store.mergeRemoteChanges(() => {
            const remove: TLRecordId[] = []
            const restore: TLRecord[] = []
            for (const [id, change] of changes) {
              if (editor.store.get(id) !== change.after) continue
              if (change.before) restore.push(change.before)
              else remove.push(id)
            }
            editor.store.remove(remove)
            editor.store.put(restore)
          }),
        { history: 'ignore' },
      )
    }
    changes.clear()
  }
  return {
    clear,
    apply(action: () => void) {
      if (editor.isDisposed || editor.getIsReadonly()) return
      editor.run(
        () => {
          clear()
          const before = getSnapshot(editor.store).document.store
          editor.store.mergeRemoteChanges(action)
          const after = getSnapshot(editor.store).document.store
          for (const id of new Set([
            ...Object.keys(before),
            ...Object.keys(after),
          ])) {
            const recordId = id as TLRecordId
            if (before[recordId] !== after[recordId]) {
              changes.set(recordId, {
                before: before[recordId],
                after: after[recordId],
              })
            }
          }
          previews.set(editor, changes)
          clearers.set(editor, clear)
          versions.set(editor, getEditorPreviewVersion(editor) + 1)
        },
        { history: 'ignore' },
      )
    },
  }
}
