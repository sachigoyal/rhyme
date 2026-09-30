import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import { useFilesCache } from './cache'

function useInvalidateFolders() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries(trpc.folders.list.queryFilter())
}

export function useCreateFolder() {
  const trpc = useTRPC()
  const onSettled = useInvalidateFolders()
  return useMutation(trpc.folders.create.mutationOptions({ onSettled }))
}

export function useRenameFolder() {
  const trpc = useTRPC()
  const onSettled = useInvalidateFolders()
  return useMutation(trpc.folders.rename.mutationOptions({ onSettled }))
}

export function useDeleteFolder() {
  const trpc = useTRPC()
  const invalidateFolders = useInvalidateFolders()
  const cache = useFilesCache()
  return useMutation(
    trpc.folders.delete.mutationOptions({
      onSettled: () =>
        Promise.all([invalidateFolders(), cache.invalidateLists()]),
    }),
  )
}
