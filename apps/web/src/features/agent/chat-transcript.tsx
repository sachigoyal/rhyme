import type { UIMessage } from 'ai'
import { MessageSquare } from 'lucide-react'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@rhyme/ui/components/message-scroller'
import { AgentMessage } from './agent-message'

export function ChatTranscript({
  messages,
  compact = false,
  scrollable = true,
}: {
  messages: UIMessage[]
  compact?: boolean
  scrollable?: boolean
}) {
  if (!scrollable)
    return (
      <div className={compact ? 'space-y-4' : 'space-y-5'}>
        {messages.length ? (
          messages.map((message) => (
            <AgentMessage key={message.id} message={message} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <MessageSquare className="size-7 text-muted-foreground" />
            <p className="text-sm">No messages</p>
          </div>
        )}
      </div>
    )

  return (
    <MessageScrollerProvider>
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent
            className={
              compact
                ? 'gap-4 p-3'
                : 'mx-auto w-full max-w-3xl gap-5 px-3 py-4 sm:px-5'
            }
          >
            {messages.length ? (
              messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <AgentMessage message={message} />
                </MessageScrollerItem>
              ))
            ) : (
              <MessageScrollerItem messageId="empty">
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <MessageSquare className="size-7 text-muted-foreground" />
                  <p className="text-sm">No messages</p>
                </div>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
