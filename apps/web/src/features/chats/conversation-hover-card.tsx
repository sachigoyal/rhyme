import type { ReactNode } from 'react'
import { Frame } from 'lucide-react'
import type { ChatSummary } from '@rhyme/trpc-client'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@rhyme/ui/components/hover-card'
import { timeAgo } from '@/lib/format'

export function ConversationHoverCard({
  chat,
  children,
  side = 'right',
}: {
  chat: Pick<ChatSummary, 'title' | 'fileName' | 'messageCount' | 'updatedAt'>
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <HoverCard openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align="start"
        className="space-y-3 border p-4 shadow-none ring-0"
      >
        <p className="text-sm font-medium leading-relaxed">{chat.title}</p>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Frame className="size-3.5 shrink-0" />
          <span className="truncate">{chat.fileName}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          {chat.messageCount} {chat.messageCount === 1 ? 'message' : 'messages'}{' '}
          · Updated {timeAgo(chat.updatedAt)}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
