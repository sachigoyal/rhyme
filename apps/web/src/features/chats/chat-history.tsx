import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import { useChats } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import { RefreshNotice } from '@/components/refresh-notice'
import { SearchInput } from '@/components/search-input'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { ScrollArea } from '@rhyme/ui/components/scroll-area'
import { cn } from '@rhyme/ui/lib/utils'
import { ConversationHoverCard } from './conversation-hover-card'
import { ConversationActions } from './conversation-actions'

import { ConversationSkeleton } from './conversation-skeleton'

const ConversationDetail = lazy(() => import('./conversation-detail'))

export function ChatHistory({ chatId }: { chatId?: string }) {
  const [search, setSearch] = useState('')
  const chats = useChats()
  const navigate = useNavigate()
  const visible = chats.data?.filter((chat) =>
    `${chat.title} ${chat.fileName} ${chat.lastMessage}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  return (
    <div className="native-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <section
        className={cn(
          'bg-card shrink-0 border-b lg:w-80 lg:border-b-0 lg:border-r xl:w-96',
          chatId && 'hidden',
        )}
        aria-label="Conversation history"
      >
        <div className="space-y-4 p-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Conversations
            </h1>
          </div>
          <SearchInput
            label="Search conversations"
            value={search}
            onChange={setSearch}
          />
        </div>
        <ScrollArea
          viewportClassName="h-auto max-h-[calc(100svh-15rem)] [&>div]:block!"
          viewportProps={{ 'aria-label': 'Conversations' }}
        >
          <div className="px-2 pb-4">
            {chats.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="m-3 h-9" />
              ))}
            {chats.isError && !chats.data && (
              <div className="p-4 text-sm">
                <p>Couldn’t load conversations.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void chats.refetch()}
                >
                  Try again
                </Button>
              </div>
            )}
            {chats.isError && chats.data && (
              <RefreshNotice onRetry={chats.refetch} />
            )}
            {visible?.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  'group/conversation hover:bg-muted/60 mb-0.5 flex h-11 items-center rounded-md transition-colors',
                  chatId === chat.id && 'bg-muted',
                )}
              >
                <ConversationHoverCard chat={chat}>
                  <button
                    type="button"
                    disabled={chat.id.startsWith('pending:')}
                    onClick={() =>
                      void navigate({ to: '/chats', search: { chat: chat.id } })
                    }
                    className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-3 text-left"
                  >
                    <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {chat.title}
                    </span>
                  </button>
                </ConversationHoverCard>
                {!chat.id.startsWith('pending:') && (
                  <ConversationActions chat={chat} />
                )}
              </div>
            ))}
            {visible?.length === 0 && (
              <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                {search
                  ? 'No matching conversations.'
                  : 'Start a conversation with the assistant on any canvas.'}
              </p>
            )}
          </div>
        </ScrollArea>
      </section>
      {chatId ? (
        <Suspense fallback={<ConversationSkeleton />}>
          <ConversationDetail
            key={chatId}
            id={chatId}
            onComplete={() => void chats.refetch()}
          />
        </Suspense>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="mb-2 grid size-12 place-items-center rounded-xl border">
            <MessageSquare className="text-muted-foreground size-5" />
          </div>
          <h2 className="text-xl font-medium tracking-tight">
            Select a conversation
          </h2>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            View messages and canvas changes, or continue a conversation.
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/">
              Open canvas
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
