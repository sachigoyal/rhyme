import { useRouterState } from '@tanstack/react-router'
import { getSeoPage } from '@/lib/seo'
import {
  AppSkeleton,
  CanvasSkeleton,
  GuestCanvasSkeleton,
} from './loading-states'
import { PageNotFound } from './recovery-state'
import {
  ConversationListSkeleton,
  ConversationSkeleton,
} from '@/features/chats/conversation-skeleton'

export function RoutePending() {
  const href = useRouterState({ select: (state) => state.location.href })
  const page = getSeoPage(href)
  if (page.id === 'home') return <GuestCanvasSkeleton />
  if (page.id === 'canvas') return <CanvasSkeleton />
  if (page.id === 'conversations') {
    const selected = new URL(href, 'http://localhost').searchParams.has('chat')
    return (
      <AppSkeleton hideHeader={selected}>
        {selected ? <ConversationSkeleton /> : <ConversationListSkeleton />}
      </AppSkeleton>
    )
  }
  if (page.id === 'not-found') return <PageNotFound />
  return <AppSkeleton />
}
