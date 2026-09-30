import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'

export function useCollaborators(fileId: string, enabled = true) {
  const trpc = useTRPC()
  return useQuery(
    trpc.collaborators.list.queryOptions({ id: fileId }, { enabled }),
  )
}
