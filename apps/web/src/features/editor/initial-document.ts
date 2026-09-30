import type { FileDocument } from '@rhyme/trpc-client'
import { documentCache } from './document-cache'

// Prefers unsynced local edits when they were made on top of the server's current version.
export async function resolveInitialDocument(
  fileId: string,
  remote: FileDocument | undefined,
  readLocal = documentCache.get,
) {
  const local = await readLocal(fileId).catch(() => undefined)

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
