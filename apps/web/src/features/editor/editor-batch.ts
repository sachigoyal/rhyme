import type { Editor } from 'tldraw'

const batches = new WeakMap<Editor, () => () => void>()

export function registerEditorBatch(editor: Editor, begin: () => () => void) {
  batches.set(editor, begin)
  return () => {
    if (batches.get(editor) === begin) batches.delete(editor)
  }
}

export function beginEditorBatch(editor: Editor) {
  return batches.get(editor)?.() ?? (() => {})
}
