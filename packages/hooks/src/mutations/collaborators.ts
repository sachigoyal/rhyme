import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

function useInvalidateCollaborators() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return (_data: unknown, _error: unknown, { id }: { id: string }) =>
    queryClient.invalidateQueries(trpc.collaborators.list.queryFilter({ id }))
}

export function useUpsertCollaborator() {
  const trpc = useTRPC()
  const onSettled = useInvalidateCollaborators()
  return useMutation(trpc.collaborators.upsert.mutationOptions({ onSettled }))
}

export function useRemoveCollaborator() {
  const trpc = useTRPC()
  const onSettled = useInvalidateCollaborators()
  return useMutation(trpc.collaborators.remove.mutationOptions({ onSettled }))
}
