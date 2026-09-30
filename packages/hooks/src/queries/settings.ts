import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useSettings() {
  const trpc = useTRPC()
  return useQuery(
    trpc.settings.get.queryOptions(undefined, { staleTime: 5 * 60 * 1000 }),
  )
}
