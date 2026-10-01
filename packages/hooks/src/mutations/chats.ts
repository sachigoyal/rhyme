import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorCode, useTRPC } from '@rhyme/trpc-client'
import type {
  ChatDetail,
  ChatSummary,
  ChatsListInput,
} from '@rhyme/trpc-client'
import {
  pendingId,
  queryInput,
  sessionUser,
  useFilesCache,
  useOptimisticCache,
} from '../cache'

const sortChats = (rows: ChatSummary[]) =>
  [...rows]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 200)

function useChatsCache() {
  const trpc = useTRPC()
  const cache = useOptimisticCache()
  return {
    ...cache,
    listUpdate: (
      update: (rows: ChatSummary[], input: ChatsListInput) => ChatSummary[],
    ) => ({
      filter: trpc.chats.list.queryFilter(),
      update: (data: unknown, key: readonly unknown[]) =>
        data &&
        update(data as ChatSummary[], queryInput<ChatsListInput>(key) ?? {}),
    }),
    detailUpdate: (id: string, update: (detail: ChatDetail) => ChatDetail) => ({
      filter: trpc.chats.get.queryFilter({ id }),
      update: (data: unknown) => data && update(data as ChatDetail),
    }),
    listInvalidation: { scope: 'chats', filter: trpc.chats.list.queryFilter() },
    detailInvalidation: (id: string) => ({
      scope: 'chats',
      filter: trpc.chats.get.queryFilter({ id }),
    }),
    activityInvalidation: {
      scope: 'chats',
      filter: trpc.chats.activity.queryFilter(),
    },
    analyticsInvalidation: {
      scope: 'chats',
      filter: trpc.chats.analytics.queryFilter(),
    },
  }
}

export function useCreateChat() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const files = useFilesCache()
  const cache = useChatsCache()
  return useMutation(
    trpc.chats.create.mutationOptions({
      onMutate: async ({ fileId }) => {
        const now = new Date()
        const chat: ChatSummary = {
          id: pendingId(),
          fileId,
          userId: sessionUser(queryClient)?.id ?? '',
          fileName: files.find(fileId)?.name ?? 'Untitled',
          title: 'New conversation',
          titleSource: 'pending',
          status: 'ready',
          lastMessage: '',
          messageCount: 0,
          toolCallCount: 0,
          createdAt: now,
          updatedAt: now,
          runCount: 0,
          errorCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          durationMs: 0,
        }
        const transaction = await cache.begin(
          ['chats'],
          [
            cache.listUpdate((rows, input) => {
              if (input.fileId && input.fileId !== fileId) return rows
              return sortChats([
                ...rows.filter((row) => row.id !== chat.id),
                chat,
              ])
            }),
          ],
        )
        return { transaction, chat }
      },
      onSuccess: (saved, _input, context) => {
        if (!saved || !context) return
        Object.assign(context.chat, saved)
        cache.refresh(context.transaction)
      },
      onError: (_error, _input, context) =>
        cache.rollback(context?.transaction),
      onSettled: (_data, _error, _input, context) =>
        cache.settle(context?.transaction, [
          cache.listInvalidation,
          cache.activityInvalidation,
          cache.analyticsInvalidation,
        ]),
    }),
  )
}

export function useRenameChat() {
  const trpc = useTRPC()
  const cache = useChatsCache()
  return useMutation(
    trpc.chats.rename.mutationOptions({
      onMutate: ({ id, title }) => {
        const update = {
          title: title.trim(),
          titleSource: 'manual' as const,
          updatedAt: new Date(),
        }
        return cache.begin(
          ['chats'],
          [
            cache.detailUpdate(id, (detail) => ({
              ...detail,
              chat: { ...detail.chat, ...update },
            })),
            cache.listUpdate((rows) =>
              sortChats(
                rows.map((chat) =>
                  chat.id === id ? { ...chat, ...update } : chat,
                ),
              ),
            ),
          ],
        )
      },
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, { id }, transaction) =>
        cache.settle(transaction, [
          cache.listInvalidation,
          cache.activityInvalidation,
          cache.detailInvalidation(id),
        ]),
    }),
  )
}

export function useDeleteChat() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useChatsCache()
  return useMutation(
    trpc.chats.delete.mutationOptions({
      onMutate: ({ id }) =>
        cache.begin(
          ['chats'],
          [cache.listUpdate((rows) => rows.filter((chat) => chat.id !== id))],
        ),
      onSuccess: (_data, { id }) =>
        queryClient.removeQueries(trpc.chats.get.queryFilter({ id })),
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, _input, transaction) =>
        cache.settle(transaction, [
          cache.listInvalidation,
          cache.activityInvalidation,
          cache.analyticsInvalidation,
        ]),
    }),
  )
}

export function useRecordChatChange() {
  const trpc = useTRPC()
  const cache = useChatsCache()
  return useMutation(
    trpc.chats.recordChange.mutationOptions({
      onMutate: async ({ id, toolCallId, preview }) => {
        const previewRef = { value: preview }
        const transaction = await cache.begin(
          ['chats'],
          [
            cache.detailUpdate(id, (detail) => ({
              ...detail,
              changes: detail.changes.map((change) =>
                change.toolCallId === toolCallId
                  ? { ...change, previewUrl: previewRef.value }
                  : change,
              ),
            })),
          ],
        )
        return { transaction, previewRef }
      },
      onSuccess: (saved, _input, context) => {
        if (!context) return
        context.previewRef.value = saved.previewUrl
        cache.refresh(context.transaction)
      },
      onError: (_error, _input, context) =>
        cache.rollback(context?.transaction),
      onSettled: (_data, _error, { id }, context) =>
        cache.settle(context?.transaction, [cache.detailInvalidation(id)]),
      retry: (count, error) => count < 3 && errorCode(error) === 'BAD_REQUEST',
      retryDelay: (attempt) => 300 * 2 ** attempt,
    }),
  )
}
