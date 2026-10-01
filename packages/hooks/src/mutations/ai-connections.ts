import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useSaveAIConnection() {
  const trpc = useTRPC()
  const cache = useQueryClient()
  return useMutation(
    trpc.aiConnections.save.mutationOptions({
      onSuccess: () =>
        cache.invalidateQueries(trpc.aiConnections.list.queryFilter()),
      gcTime: 0,
    }),
  )
}

export function useTestAIConnection() {
  const trpc = useTRPC()
  return useMutation(trpc.aiConnections.test.mutationOptions({ gcTime: 0 }))
}

export function useRemoveAIConnection() {
  const trpc = useTRPC()
  const cache = useQueryClient()
  return useMutation(
    trpc.aiConnections.remove.mutationOptions({
      onSuccess: () =>
        cache.invalidateQueries(trpc.aiConnections.list.queryFilter()),
    }),
  )
}
