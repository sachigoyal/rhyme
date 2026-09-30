import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import { useFilesCache } from './cache'

export function useCreateFile() {
  const trpc = useTRPC()
  const cache = useFilesCache()
  return useMutation(
    trpc.files.create.mutationOptions({ onSettled: cache.invalidateLists }),
  )
}

export function useRenameFile() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useFilesCache()

  return useMutation(
    trpc.files.rename.mutationOptions({
      onMutate: ({ id, name }) => {
        queryClient.setQueryData(trpc.files.get.queryKey({ id }), (file) =>
          file ? { ...file, name } : file,
        )
        return cache.updateLists((files) =>
          files.map((file) => (file.id === id ? { ...file, name } : file)),
        )
      },
      onError: (_error, _input, rollback) => rollback?.(),
      onSettled: (_data, _error, { id }) => {
        void cache.invalidateLists()
        void cache.invalidateFile(id)
      },
    }),
  )
}

export function useMoveFile() {
  const trpc = useTRPC()
  const cache = useFilesCache()
  return useMutation(
    trpc.files.move.mutationOptions({ onSettled: cache.invalidateLists }),
  )
}

function useRemoveFromLists() {
  const cache = useFilesCache()
  return {
    onMutate: ({ id }: { id: string }) =>
      cache.updateLists((files) => files.filter((file) => file.id !== id)),
    onError: (_error: unknown, _input: unknown, rollback?: () => void) =>
      rollback?.(),
    onSettled: cache.invalidateLists,
  }
}

export function useTrashFile() {
  const trpc = useTRPC()
  return useMutation(trpc.files.trash.mutationOptions(useRemoveFromLists()))
}

export function useRestoreFile() {
  const trpc = useTRPC()
  return useMutation(trpc.files.restore.mutationOptions(useRemoveFromLists()))
}

export function useDestroyFile() {
  const trpc = useTRPC()
  return useMutation(trpc.files.destroy.mutationOptions(useRemoveFromLists()))
}

export function useSaveFileDocument() {
  const trpc = useTRPC()
  const cache = useFilesCache()
  return useMutation(
    trpc.files.saveDocument.mutationOptions({
      onSuccess: async (saved, { id }) => {
        await cache.updateLists((files) =>
          files.map((file) => (file.id === id ? { ...file, ...saved } : file)),
        )
        await cache.invalidateLists()
      },
    }),
  )
}
