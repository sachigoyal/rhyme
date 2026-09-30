import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateFile, useSaveFileDocument } from '@rhyme/hooks/mutations'
import { useFiles, useProfile } from '@rhyme/hooks/queries'
import { guestDraft } from './guest-draft'

export function useOpenRecentCanvas() {
  const files = useFiles()
  const shared = useFiles({ view: 'shared' })
  const profile = useProfile()
  const createFile = useCreateFile()
  const saveDocument = useSaveFileDocument()
  const navigate = useNavigate()
  const started = useRef(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (
      !files.data ||
      !shared.data ||
      profile.data === undefined ||
      started.current
    )
      return
    started.current = true
    const open = async () => {
      const [ownedResult, sharedResult] = await Promise.all([
        files.refetch(),
        shared.refetch(),
      ])
      if (ownedResult.error) throw ownedResult.error
      if (sharedResult.error) throw sharedResult.error
      const ownedFiles = ownedResult.data ?? []
      const sharedFiles = sharedResult.data ?? []
      if (!profile.data && !ownedFiles.length && !sharedFiles.length) {
        await navigate({ to: '/onboarding' })
        return
      }
      const draft = guestDraft.get()
      const recent = [
        ...ownedFiles,
        ...sharedFiles.filter((file) => file.role !== 'viewer'),
      ].sort(
        (first, second) =>
          second.updatedAt.getTime() - first.updatedAt.getTime(),
      )
      let fileId = recent[0]?.id
      if (draft) {
        fileId =
          draft.fileId ??
          (await createFile.mutateAsync({ name: 'My first canvas' })).id
        guestDraft.set(draft.document, fileId)
        const version =
          ownedFiles.find((file) => file.id === fileId)?.version ?? 0
        await saveDocument.mutateAsync({
          id: fileId,
          baseVersion: version,
          document: draft.document,
        })
        guestDraft.clear()
      }
      fileId ??= (await createFile.mutateAsync({})).id
      await navigate({ to: '/files/$fileId', params: { fileId } })
    }
    void open().catch((cause: unknown) =>
      setError(
        cause instanceof Error
          ? cause
          : new Error('Couldn’t open your canvas.'),
      ),
    )
  }, [
    files.data,
    shared.data,
    files.refetch,
    shared.refetch,
    profile.data,
    createFile,
    saveDocument,
    navigate,
  ])

  return error ?? files.error ?? shared.error ?? profile.error
}
