import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, MoreHorizontal } from 'lucide-react'
import { errorCode } from '@rhyme/trpc-client'
import { RefreshNotice } from '@/components/refresh-notice'
import { RecoveryState } from '@/components/recovery-state'
import { useChat } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rhyme/ui/components/popover'
import { ChatChangePreviews } from '@/features/agent/chat-transcript'
import { timeAgo } from '@/lib/format'
import { ConversationSession } from './conversation-session'
import { ConversationHeader, ConversationSkeleton } from './conversation-header'

export default function ConversationDetail({
  id,
  onComplete,
}: {
  id: string
  onComplete: () => void
}) {
  const detail = useChat(id)
  const [contextOpen, setContextOpen] = useState(false)
  if (detail.isPending) return <ConversationSkeleton />
  const code = errorCode(detail.error)
  const unavailable =
    code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'BAD_REQUEST'
  if (detail.isError && (!detail.data || unavailable))
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ConversationHeader title="Conversation unavailable" />
        <RecoveryState
          sketch={
            code === 'FORBIDDEN'
              ? 'access'
              : unavailable
                ? 'conversation'
                : 'connection'
          }
          title={
            code === 'FORBIDDEN'
              ? 'Access denied'
              : unavailable
                ? 'Conversation unavailable'
                : 'Unable to load conversation'
          }
          description={
            code === 'FORBIDDEN'
              ? 'You don’t have access to this conversation. Ask the canvas owner to check your permissions.'
              : unavailable
                ? 'This conversation may have been deleted, or you may no longer have access to its canvas.'
                : 'Check your connection and try again.'
          }
          onRetry={
            unavailable
              ? undefined
              : async () => {
                  const result = await detail.refetch()
                  if (result.error) throw result.error
                }
          }
        >
          <Button asChild variant={unavailable ? 'default' : 'outline'}>
            <Link to="/chats">View conversations</Link>
          </Button>
        </RecoveryState>
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
                label="Total run time"
                value={`${((chat.durationMs ?? 0) / 1000).toFixed(1)}s`}
              />
            </dl>
            {changes.length > 0 && <ChatChangePreviews changes={changes} />}
          </PopoverContent>
        </Popover>
      </ConversationHeader>
      {detail.isError && (
        <div className="px-5 pt-5">
          <RefreshNotice onRetry={detail.refetch} />
        </div>
      )}
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

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
