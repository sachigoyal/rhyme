import { useRef, useState } from 'react'
import { useSaveFileDocument } from '@rhyme/hooks/mutations'
import { useTRPCClient } from '@rhyme/trpc-client'
import { DocumentSync } from './document-sync'
import type { InitialDocument } from './use-initial-document'

export function useDocumentSync(
  fileId: string,
  initial: InitialDocument,
  editable: boolean,
) {
  const trpc = useTRPCClient()
  const { mutateAsync: save } = useSaveFileDocument()
  const saveRef = useRef(save)
  saveRef.current = save

  const [sync] = useState(() =>
    editable
      ? new DocumentSync({
          fileId,
          version: initial.version,
          dirty: initial.dirty,
          save: (input) => saveRef.current(input),
          fetchVersion: async () =>
            (await trpc.files.get.query({ id: fileId })).version,
        })
      : null,
  )
  return sync
}
