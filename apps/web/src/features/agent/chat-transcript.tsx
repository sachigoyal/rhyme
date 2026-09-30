import type { UIMessage } from 'ai'
import { MessageSquare, Shapes } from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@rhyme/ui/components/marker'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@rhyme/ui/components/message-scroller'
import { env } from '@/lib/env'
import { AgentMessage } from './agent-message'

type ChatChange = {
  id: string
  summary: string
  toolName: string
  createdAt: string | Date
  previewUrl: string | null
}

export function ChatChangePreviews({ changes }: { changes: ChatChange[] }) {
  if (!changes.length) return null

  return (
    <div className="space-y-3">
      <Marker className="text-xs">
        <MarkerIcon>
          <Shapes className="size-3.5" />
        </MarkerIcon>
        <MarkerContent>Canvas changes</MarkerContent>
      </Marker>
      <div className="grid gap-3 sm:grid-cols-2">
        {changes.map((change) => (
          <figure key={change.id} className="overflow-hidden rounded-xl border">
            {change.previewUrl ? (
              <img
                src={
                  change.previewUrl.startsWith('/')
                    ? `${env.apiUrl}${change.previewUrl}`
                    : change.previewUrl
                }
                alt={change.summary}
                loading="lazy"
                className="aspect-[4/3] w-full bg-white object-contain"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-muted/30">
                <Shapes className="size-6 text-muted-foreground" />
              </div>
            )}
            <figcaption className="border-t p-3">
              <p className="text-xs font-medium">{change.summary}</p>
              <p className="text-muted-foreground mt-1 text-[10px]">
                {new Date(change.createdAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function ChatTranscript({
  messages,
  changes = [],
  compact = false,
  scrollable = true,
}: {
  messages: UIMessage[]
  changes?: ChatChange[]
  compact?: boolean
  scrollable?: boolean
}) {
  if (!scrollable)
    return (
      <div className={compact ? 'space-y-5' : 'space-y-7'}>
        {messages.length ? (
          messages.map((message) => (
            <AgentMessage key={message.id} message={message} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <MessageSquare className="size-7 text-muted-foreground" />
            <p className="text-sm">
              This conversation is ready for its first idea.
            </p>
          </div>
        )}
        {changes.length > 0 && <ChatChangePreviews changes={changes} />}
      </div>
    )

  return (
    <MessageScrollerProvider>
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent
            className={
              compact
                ? 'gap-5 p-4'
                : 'mx-auto max-w-3xl gap-7 px-5 py-8 sm:px-8'
            }
          >
            {messages.length ? (
              messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === 'user'}
                >
                  <AgentMessage message={message} />
                </MessageScrollerItem>
              ))
            ) : (
              <MessageScrollerItem messageId="empty">
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <MessageSquare className="size-7 text-muted-foreground" />
                  <p className="text-sm">
                    This conversation is ready for its first idea.
                  </p>
                </div>
              </MessageScrollerItem>
            )}
            {changes.length > 0 && (
              <MessageScrollerItem messageId="changes">
                <ChatChangePreviews changes={changes} />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
