import { useEffect, useRef, useState } from 'react'
import { useImportGuestCanvas } from '@rhyme/hooks/mutations'
import { guestDraft } from './guest-draft'

export function useImportGuestDraft(userId: string) {
  const { mutateAsync } = useImportGuestCanvas()
  const started = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const save = async () => {
      const draft = guestDraft.claim(userId)
      if (draft) {
        await mutateAsync({ id: draft.import.fileId, document: draft.document })
        guestDraft.clear(draft.id)
      }
    }
    const { locks } = navigator as Partial<Navigator>
    const task = locks ? locks.request('rhyme:guest-import', save) : save()
    void task
      .then(() => setReady(true))
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause
            : new Error('Unable to save your guest canvas.'),
        )
      })
  }, [userId, mutateAsync])
  return { ready, error }
}
