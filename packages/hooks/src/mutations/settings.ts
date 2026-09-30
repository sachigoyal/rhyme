import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import { useOptimisticCache } from '../cache'

export function useUpdateSettings() {
  const trpc = useTRPC()
  const cache = useOptimisticCache()
  return useMutation(
    trpc.settings.update.mutationOptions({
      onMutate: (input) =>
        cache.begin(
          ['settings'],
          [
            {
              filter: trpc.settings.get.queryFilter(),
              update: (data) =>
                data ? { ...(data as object), ...input } : data,
            },
          ],
        ),
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, _input, transaction) =>
        cache.settle(transaction, [
          { scope: 'settings', filter: trpc.settings.get.queryFilter() },
        ]),
    }),
  )
}
