import { useEffect, useState } from 'react'
import { useFileDocument } from '@rhyme/hooks/queries'
import type { DocumentSnapshot, FileDocument } from '@rhyme/trpc-client'
import { documentCache } from './document-cache'

export interface InitialDocument {
  document: DocumentSnapshot | null
  version: number
  dirty: boolean
  offline: boolean
}

// Prefers unsynced local edits when they were made on top of the server's current version.
async function resolveInitialDocument(
  fileId: string,
  remote: FileDocument | undefined,
) {
  const local = await documentCache.get(fileId)

  if (!remote) {
    return local
      ? {
          document: local.document,
          version: local.baseVersion,
          dirty: local.dirty,
          offline: true,
        }
      : null
  }
  if (local?.dirty && local.baseVersion === remote.version) {
    return {
      document: local.document,
      version: remote.version,
      dirty: true,
      offline: false,
    }
  }
  return {
    document: remote.document,
    version: remote.version,
    dirty: false,
    offline: false,
  }
}

export function useInitialDocument(fileId: string) {
  const remote = useFileDocument(fileId)
  const [initial, setInitial] = useState<InitialDocument | null>(null)
  const [failed, setFailed] = useState(false)
  const settled = !remote.isPending

  useEffect(() => {
    if (!settled || initial) return
    let cancelled = false
    void resolveInitialDocument(fileId, remote.data).then((resolved) => {
      if (cancelled) return
      if (resolved) setInitial(resolved)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [fileId, settled, remote.data, initial])

  return { initial, failed }
}
