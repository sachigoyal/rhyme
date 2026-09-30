import { Link } from '@tanstack/react-router'
import { errorCode } from '@rhyme/trpc-client'
import { RefreshNotice } from '@/components/refresh-notice'
import { RecoveryState } from '@/components/recovery-state'
import { useChat } from '@rhyme/hooks/queries'
import { buttonVariants } from '@rhyme/ui/components/button'
import { ConversationSession } from './conversation-session'
import { ConversationHeader } from './conversation-header'
import { ConversationSkeleton } from './conversation-skeleton'

export default function ConversationDetail({
  id,
  onComplete,
}: {
  id: string
  onComplete: () => void
}) {
  const detail = useChat(id)
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
          <Link
            to="/chats"
            className={buttonVariants({
              variant: unavailable ? 'default' : 'outline',
            })}
          >
            View conversations
          </Link>
        </RecoveryState>
      </section>
    )
  const { chat } = detail.data
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ConversationHeader title={chat.title} />
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
