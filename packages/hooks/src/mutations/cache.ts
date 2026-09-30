import { useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { FileSummary } from '@rhyme/trpc-client'

export function useFilesCache() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const lists = trpc.files.list.queryFilter()

  return {
    // Patches every cached file list and returns a rollback.
    async updateLists(update: (files: FileSummary[]) => FileSummary[]) {
      await queryClient.cancelQueries(lists)
      const previous = queryClient.getQueriesData<FileSummary[]>(lists)
      queryClient.setQueriesData<FileSummary[]>(
        lists,
        (files) => files && update(files),
      )
      return () => {
        for (const [key, data] of previous) queryClient.setQueryData(key, data)
      }
    },
    invalidateLists: () => queryClient.invalidateQueries(lists),
    invalidateFile: (id: string) =>
      queryClient.invalidateQueries(trpc.files.get.queryFilter({ id })),
  }
}
