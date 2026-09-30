import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { WorkspaceShell } from '@/features/files/workspace-shell'
import { ChatHistory } from '@/features/chats/chat-history'

export const Route = createFileRoute('/_app/chats')({
  validateSearch: z.object({ chat: z.string().optional() }),
  loaderDeps: ({ search }) => ({ chatId: search.chat }),
  loader: ({ context, deps }) => {
    if (deps.chatId)
      void context.queryClient.prefetchQuery(
        context.trpc.chats.get.queryOptions({ id: deps.chatId }),
      )
  },
  component: ConversationsPage,
})

function ConversationsPage() {
  const { user } = Route.useRouteContext()
  const { chat } = Route.useSearch()
  return (
    <WorkspaceShell
      user={user}
      section="chats"
      title="Conversations"
      chatId={chat}
      hideHeader={Boolean(chat)}
    >
      <ChatHistory chatId={chat} />
    </WorkspaceShell>
  )
}
