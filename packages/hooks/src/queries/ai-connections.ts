import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useAIConnections() {
  const trpc = useTRPC()
  return useQuery(
    trpc.aiConnections.list.queryOptions(undefined, { staleTime: 60_000 }),
  )
}
