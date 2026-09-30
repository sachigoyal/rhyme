import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useCompleteProfile() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return useMutation(
    trpc.profile.complete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(trpc.profile.get.queryFilter()),
    }),
  )
}
