import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useFolders() {
  const trpc = useTRPC()
  return useQuery(trpc.folders.list.queryOptions())
}
