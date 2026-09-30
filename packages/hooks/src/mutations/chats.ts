import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorCode, useTRPC } from '@rhyme/trpc-client'

function useChatCache() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries(trpc.chats.pathFilter())
}

export function useCreateChat() {
  const trpc = useTRPC()
  const invalidate = useChatCache()
  return useMutation(
    trpc.chats.create.mutationOptions({ onSettled: invalidate }),
  )
}

export function useRenameChat() {
  const trpc = useTRPC()
  const invalidate = useChatCache()
  return useMutation(
    trpc.chats.rename.mutationOptions({ onSettled: invalidate }),
  )
}

export function useDeleteChat() {
  const trpc = useTRPC()
  const invalidate = useChatCache()
  return useMutation(
    trpc.chats.delete.mutationOptions({ onSettled: invalidate }),
  )
}

export function useRecordChatChange() {
  const trpc = useTRPC()
  const invalidate = useChatCache()
  return useMutation(
    trpc.chats.recordChange.mutationOptions({
      onSettled: invalidate,
      retry: (count, error) => count < 3 && errorCode(error) === 'BAD_REQUEST',
      retryDelay: (attempt) => 300 * 2 ** attempt,
    }),
  )
}
