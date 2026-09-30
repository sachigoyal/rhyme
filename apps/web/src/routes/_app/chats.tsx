import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { WorkspaceShell } from '@/features/files/workspace-shell'
import { ChatHistory } from '@/features/chats/chat-history'

export const Route = createFileRoute('/_app/chats')({
  validateSearch: z.object({ chat: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Conversations · Rhyme' }] }),
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
