import { useEffect, useRef, useState } from 'react'
import { useImportGuestCanvas } from '@rhyme/hooks/mutations'
import { guestDraft } from './guest-draft'

export function useImportGuestDraft(userId: string) {
  const { mutateAsync } = useImportGuestCanvas()
  const taskRef = useRef<{ userId: string; task: Promise<void> } | null>(null)
  const [result, setResult] = useState({
    userId,
    ready: false,
    error: null as Error | null,
  })

  useEffect(() => {
    let active = true
    if (taskRef.current?.userId !== userId) {
      const save = async () => {
        const draft = guestDraft.claim(userId)
        if (draft) {
          await mutateAsync({
            id: draft.import.fileId,
            document: draft.document,
          })
          guestDraft.clear(draft.id)
        }
      }
      const task = Promise.resolve().then(() =>
        navigator.locks
          ? navigator.locks.request('rhyme:guest-import', save)
          : save(),
      )
      taskRef.current = { userId, task }
    }
    void taskRef.current.task.then(
      () => {
        if (active) setResult({ userId, ready: true, error: null })
      },
      (cause: unknown) => {
        if (active)
          setResult({
            userId,
            ready: false,
            error:
              cause instanceof Error
                ? cause
                : new Error('Unable to save your guest canvas.'),
          })
      },
    )
    return () => {
      active = false
    }
  }, [userId, mutateAsync])
  return result.userId === userId ? result : { ready: false, error: null }
}
