import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { FileSummary, FilesListInput } from '@rhyme/trpc-client'

export function useFiles(input: FilesListInput = {}) {
  const trpc = useTRPC()
  return useQuery(
    trpc.files.list.queryOptions({
      view: input.view ?? 'mine',
      folderId: input.folderId,
    }),
  )
}

export function useFile(id: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return useQuery(
    trpc.files.get.queryOptions(
      { id },
      {
        placeholderData: () =>
          queryClient
            .getQueriesData<FileSummary[]>(trpc.files.list.queryFilter())
            .flatMap(([, rows]) => rows ?? [])
            .find((file) => file.id === id),
      },
    ),
  )
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
