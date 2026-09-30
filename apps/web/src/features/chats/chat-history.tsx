import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  ArrowLeft,
  MessageSquare,
  MoreHorizontal,
  Search,
} from 'lucide-react'
import { useChat, useChats } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@rhyme/ui/components/input-group'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { SidebarTrigger } from '@rhyme/ui/components/sidebar'
import { Separator } from '@rhyme/ui/components/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rhyme/ui/components/popover'
import { cn } from '@rhyme/ui/lib/utils'
import { ChatChangePreviews } from '@/features/agent/chat-transcript'
import { timeAgo } from '@/lib/format'
import { ConversationSession } from './conversation-session'
import { ConversationHoverCard } from './conversation-hover-card'
import { ConversationActions } from './conversation-actions'

export function ChatHistory({ chatId }: { chatId?: string }) {
  const [search, setSearch] = useState('')
  const chats = useChats()
  const navigate = useNavigate()
  const visible = chats.data?.filter((chat) =>
    `${chat.title} ${chat.fileName} ${chat.lastMessage}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section
        className={cn(
          'shrink-0 border-b lg:w-80 lg:border-b-0 lg:border-r xl:w-96',
          chatId && 'hidden',
        )}
        aria-label="Conversation history"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Conversations
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Your ideas, and how they took shape.
            </p>
          </div>
          <InputGroup>
            <InputGroupInput
              placeholder="Search conversations…"
              aria-label="Search conversations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="max-h-[calc(100svh-15rem)] overflow-y-auto px-2 pb-4">
          {chats.isPending &&
            Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="m-3 h-9" />
            ))}
          {chats.isError && (
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
          {visible?.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group/conversation hover:bg-muted/60 mb-0.5 flex h-9 items-center rounded-lg transition-colors',
                chatId === chat.id && 'bg-muted',
              )}
            >
              <ConversationHoverCard chat={chat}>
                <button
                  type="button"
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
              <ConversationActions chat={chat} />
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
      </section>
      {chatId ? (
        <ConversationDetail
          key={chatId}
          id={chatId}
          onComplete={() => void chats.refetch()}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="mb-2 grid size-12 place-items-center rounded-xl border">
            <MessageSquare className="text-muted-foreground size-5" />
          </div>
          <h2 className="text-xl font-medium tracking-tight">
            Pick up a thought
          </h2>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
            Revisit a conversation, see what changed on the canvas, or jump back
            in where you left off.
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/">
              Open your canvas
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function ConversationDetail({
  id,
  onComplete,
}: {
  id: string
  onComplete: () => void
}) {
  const detail = useChat(id)
  const [contextOpen, setContextOpen] = useState(false)
  if (detail.isPending)
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ConversationHeader title="Loading conversation…" />
        <div className="flex-1 space-y-6 p-8">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      </section>
    )
  if (detail.isError)
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ConversationHeader title="Conversation unavailable" />
        <div className="flex-1 p-8">
          <p className="font-medium">This conversation is unavailable</p>
          <p className="text-muted-foreground mt-2 text-sm">
            The canvas may have been removed or your access changed.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void detail.refetch()}
          >
            Try again
          </Button>
        </div>
      </section>
    )
  const { chat, changes } = detail.data
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ConversationHeader title={chat.title}>
        <Popover open={contextOpen} onOpenChange={setContextOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Conversation context and actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-[80svh] w-80 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto border p-3 shadow-none ring-0"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{chat.fileName}</p>
              <p className="text-muted-foreground text-xs">
                Updated {timeAgo(chat.updatedAt)}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link
                to="/files/$fileId"
                params={{ fileId: chat.fileId }}
                search={{ chat: chat.id }}
              >
                Open canvas <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            <dl className="space-y-1.5 text-xs">
              <Stat label="Messages" value={chat.messageCount} />
              <Stat label="Agent runs" value={chat.runCount ?? 0} />
              <Stat label="Canvas actions" value={chat.toolCallCount} />
              <Stat
                label="Tokens used"
                value={(chat.totalTokens ?? 0).toLocaleString()}
              />
              <Stat
                label="Time working"
                value={`${((chat.durationMs ?? 0) / 1000).toFixed(1)}s`}
              />
            </dl>
            {changes.length > 0 && <ChatChangePreviews changes={changes} />}
          </PopoverContent>
        </Popover>
      </ConversationHeader>
      <ConversationSession
        detail={detail.data}
        onBusy={() => {}}
        onComplete={() => {
          void detail.refetch()
          onComplete()
        }}
      />
    </section>
  )
}

function ConversationHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="data-[orientation=vertical]:h-4"
      />
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        aria-label="All conversations"
      >
        <Link to="/chats">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
      {children}
    </header>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
