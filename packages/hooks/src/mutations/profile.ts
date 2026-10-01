import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { RouterOutputs } from '@rhyme/trpc-client'
import { useOptimisticCache } from '../cache'
import type { CachedSession } from '../cache'

export function useCompleteProfile() {
  const trpc = useTRPC()
  const cache = useOptimisticCache()
  return useMutation(
    trpc.profile.complete.mutationOptions({
      onMutate: (input) => {
        const { name, ...answers } = input
        return cache.begin(
          ['profile'],
          [
            {
              filter: trpc.profile.get.queryFilter(),
              update: (data) => {
                const profile = data as RouterOutputs['profile']['get']
                return profile ? { ...profile, ...answers } : profile
              },
            },
            {
              filter: { queryKey: ['session'], exact: true },
              update: (data) => {
                const session = data as CachedSession | null | undefined
                return session
                  ? { ...session, user: { ...session.user, name: name.trim() } }
                  : session
              },
            },
          ],
        )
      },
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, _input, transaction) =>
        cache.settle(transaction, [
          { scope: 'profile', filter: trpc.profile.get.queryFilter() },
          { scope: 'profile', filter: { queryKey: ['session'], exact: true } },
          { scope: 'files', filter: trpc.files.list.queryFilter() },
          { scope: 'files', filter: trpc.files.get.queryFilter() },
        ]),
    }),
  )
}

export function useUpdateProfilePicture(apiUrl: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File | null) => {
      const response = await fetch(new URL('/profile/picture', apiUrl), {
        method: file ? 'PUT' : 'DELETE',
        credentials: 'include',
        headers: file ? { 'content-type': file.type } : undefined,
        body: file ?? undefined,
      })
      if (!response.ok) throw new Error('Unable to save profile picture')
      return (await response.json()) as { image: string | null }
    },
    onSuccess: async ({ image }) => {
      queryClient.setQueryData(
        ['session'],
        (session: CachedSession | null | undefined) =>
          session ? { ...session, user: { ...session.user, image } } : session,
      )
      await queryClient.invalidateQueries({
        queryKey: ['session'],
        exact: true,
      })
    },
  })
}
