import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateFile } from '@rhyme/hooks/mutations'

export function useCreateAndOpenFile() {
  const navigate = useNavigate()
  const createFile = useCreateFile()

  const create = (folderId?: string) =>
    createFile.mutate(
      { folderId },
      {
        onSuccess: ({ id }) =>
          navigate({ to: '/files/$fileId', params: { fileId: id } }),
        onError: () => toast.error('Unable to create canvas'),
      },
    )

  return { create, isPending: createFile.isPending }
}
