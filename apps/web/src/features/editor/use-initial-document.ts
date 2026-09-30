import { useEffect, useState } from 'react'
import { useFileDocument } from '@rhyme/hooks/queries'
import { errorCode } from '@rhyme/trpc-client'
import type { DocumentSnapshot } from '@rhyme/trpc-client'
import { resolveInitialDocument } from './initial-document'

export interface InitialDocument {
  document: DocumentSnapshot | null
  version: number
  dirty: boolean
  offline: boolean
}

export function useInitialDocument(fileId: string) {
  const remote = useFileDocument(fileId)
  const [initial, setInitial] = useState<InitialDocument | null>(null)
  const [failed, setFailed] = useState(false)
  const settled = !remote.isPending

  useEffect(() => {
    if (!settled || initial) return
    if (
      ['FORBIDDEN', 'UNAUTHORIZED', 'NOT_FOUND'].includes(
        errorCode(remote.error) ?? '',
      )
    ) {
      setFailed(true)
      return
    }
    let cancelled = false
    void resolveInitialDocument(fileId, remote.data).then((resolved) => {
      if (cancelled) return
      if (resolved) {
        setFailed(false)
        setInitial(resolved)
      } else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [fileId, settled, remote.data, remote.error, initial])

  return { initial, failed, error: remote.error }
}
