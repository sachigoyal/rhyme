import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useProfile() {
  const trpc = useTRPC()
  return useQuery(trpc.profile.get.queryOptions())
}
