import { useNavigate } from '@tanstack/react-router'
import { toast } from '@rhyme/ui/components/toast'
import { useCreateFile } from '@rhyme/hooks/mutations'

export function useCreateAndOpenFile() {
  const navigate = useNavigate()
  const createFile = useCreateFile()

  const create = async (folderId?: string) => {
    try {
      const { id } = await createFile.mutateAsync({ folderId })
      await navigate({ to: '/files/$fileId', params: { fileId: id } })
    } catch {
      toast.error('Unable to create canvas')
    }
  }

  return { create, isPending: createFile.isPending }
}
