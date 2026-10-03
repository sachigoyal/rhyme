import { useQuery } from '@tanstack/react-query'
import type { RouterOutputs } from '@rhyme/trpc-client'
import { useTRPC } from '@rhyme/trpc-client'

export function useAIConnections(
  cached?: RouterOutputs['aiConnections']['list'],
) {
  const trpc = useTRPC()
  return useQuery(
    trpc.aiConnections.list.queryOptions(undefined, {
      staleTime: 60_000,
      placeholderData: cached,
    }),
  )
}
