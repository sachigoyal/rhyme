import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { FilesListInput } from '@rhyme/trpc-client'

export function useFiles(input: FilesListInput = {}) {
  const trpc = useTRPC()
  return useQuery(trpc.files.list.queryOptions(input))
}

export function useFile(id: string) {
  const trpc = useTRPC()
  return useQuery(trpc.files.get.queryOptions({ id }))
}

// Read once when the editor opens; the canvas owns the state afterwards.
export function useFileDocument(id: string) {
  const trpc = useTRPC()
  return useQuery(
    trpc.files.document.queryOptions(
      { id },
      {
        staleTime: Infinity,
        gcTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    ),
  )
}
