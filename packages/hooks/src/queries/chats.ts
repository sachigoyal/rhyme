import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { ChatSummary, ChatsListInput } from '@rhyme/trpc-client'

export function useChats(input: ChatsListInput = {}) {
  const trpc = useTRPC()
  return useQuery(
    trpc.chats.list.queryOptions(input, {
      staleTime: 5000,
      refetchInterval: (query) =>
        query.state.data?.some((chat) => chat.titleSource === 'generating')
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
    if (!chatId || title === undefined || !titleSource) return
    queryClient.setQueriesData<ChatSummary[]>(
      trpc.chats.list.queryFilter(),
      (rows) => {
        if (
          !rows?.some(
            (row) =>
              row.id === chatId &&
              (row.title !== title || row.titleSource !== titleSource),
          )
        )
          return rows
        return rows.map((row) =>
          row.id === chatId ? { ...row, title, titleSource } : row,
        )
      },
    )
  }, [chatId, title, titleSource, queryClient, trpc])

  return query
}

export function useAgentAnalytics(days: 7 | 30 | 90 = 30) {
  const trpc = useTRPC()
  return useQuery(trpc.chats.analytics.queryOptions({ days }))
}
