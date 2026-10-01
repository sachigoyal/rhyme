import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type {
  ChatDetail,
  ChatSummary,
  ChatsListInput,
} from '@rhyme/trpc-client'

import { patchCache, readCacheBase } from '../cache'

export function useChats(input: ChatsListInput = {}) {
  const trpc = useTRPC()
  return useQuery(
    trpc.chats.list.queryOptions(input, {
      staleTime: 5000,
      refetchInterval: (query) =>
        query.state.data?.some(
          (chat) =>
            chat.titleSource === 'generating' ||
            (chat.titleSource === 'pending' && chat.messageCount > 0),
        )
          ? 2000
          : false,
    }),
  )
}

export function useChat(id: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const query = useQuery(
    trpc.chats.get.queryOptions(
      { id },
      {
        refetchInterval: (state) => {
          const chat = state.state.data?.chat
          return chat?.messageCount &&
            (chat.titleSource === 'pending' ||
              chat.titleSource === 'generating')
            ? 2000
            : 10000
        },
      },
    ),
  )
  const chatId = query.data?.chat.id
  const title = query.data?.chat.title
  const titleSource = query.data?.chat.titleSource

  useEffect(() => {
    const confirmed = readCacheBase<ChatDetail>(
      queryClient,
      trpc.chats.get.queryKey({ id }),
    )?.chat
    if (!confirmed) return
    patchCache(queryClient, {
      filter: trpc.chats.list.queryFilter(),
      update: (data) => {
        const rows = data as ChatSummary[] | undefined
        if (
          !rows?.some(
            (row) =>
              row.id === id &&
              (row.title !== confirmed.title ||
                row.titleSource !== confirmed.titleSource),
          )
        )
          return rows
        return rows.map((row) =>
          row.id === id
            ? {
                ...row,
                title: confirmed.title,
                titleSource: confirmed.titleSource,
              }
            : row,
        )
      },
    })
  }, [id, chatId, title, titleSource, query.dataUpdatedAt, queryClient, trpc])

  return query
}

export function useAgentAnalytics(days: 7 | 30 | 90 = 30) {
  const trpc = useTRPC()
  return useQuery(trpc.chats.analytics.queryOptions({ days }))
}
