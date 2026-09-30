import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { Collaborator } from '@rhyme/trpc-client'
import { pendingId, useOptimisticCache } from '../cache'

function useCollaboratorsCache() {
  const trpc = useTRPC()
  const cache = useOptimisticCache()
  return {
    ...cache,
    update: (id: string, update: (rows: Collaborator[]) => Collaborator[]) => ({
      filter: trpc.collaborators.list.queryFilter({ id }),
      update: (data: unknown) => data && update(data as Collaborator[]),
    }),
    invalidation: (id: string) => ({
      scope: `collaborators:${id}`,
      filter: trpc.collaborators.list.queryFilter({ id }),
    }),
  }
}

export function useUpsertCollaborator() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useCollaboratorsCache()
  return useMutation(
    trpc.collaborators.upsert.mutationOptions({
      onMutate: async ({ id, email, role }) => {
        const normalized = email.trim().toLowerCase()
        const known = queryClient
          .getQueriesData<Collaborator[]>(trpc.collaborators.list.queryFilter())
          .flatMap(([, rows]) => rows ?? [])
          .find((row) => row.email === normalized)
        const collaborator: Collaborator = known
          ? { ...known, role }
          : { userId: pendingId(), name: '', email: normalized, role }
        return cache.begin(
          [`collaborators:${id}`],
          [
            cache.update(id, (rows) => {
              const existing = rows.find((row) => row.email === normalized)
              return [
                ...rows.filter((row) => row.email !== normalized),
                existing ? { ...existing, role } : collaborator,
              ].sort((a, b) => a.email.localeCompare(b.email))
            }),
          ],
        )
      },
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, { id }, transaction) =>
        cache.settle(transaction, [cache.invalidation(id)]),
    }),
  )
}

export function useRemoveCollaborator() {
  const trpc = useTRPC()
  const cache = useCollaboratorsCache()
  return useMutation(
    trpc.collaborators.remove.mutationOptions({
      onMutate: ({ id, userId }) =>
        cache.begin(
          [`collaborators:${id}`],
          [
            cache.update(id, (rows) =>
              rows.filter((row) => row.userId !== userId),
            ),
          ],
        ),
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, { id }, transaction) =>
        cache.settle(transaction, [cache.invalidation(id)]),
    }),
  )
}
