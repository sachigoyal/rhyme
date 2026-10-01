import { useRouterState } from '@tanstack/react-router'
import { getSeoPage } from '@/lib/seo'
import { AppSkeleton, CanvasSkeleton } from './loading-states'
import { BrandLoading } from './brand-loading'
import { PageNotFound } from './recovery-state'
import {
  ConversationListSkeleton,
  ConversationSkeleton,
} from '@/features/chats/conversation-skeleton'

export function RoutePending() {
  const href = useRouterState({ select: (state) => state.location.href })
  const page = getSeoPage(href)
  if (page.id === 'home') return <BrandLoading />
  if (page.id === 'canvas') return <CanvasSkeleton />
  if (page.id === 'conversations') {
    const selected = new URL(href, 'http://localhost').searchParams.has('chat')
    return (
      <AppSkeleton hideHeader={selected} title="Conversations" section="chats">
        {selected ? <ConversationSkeleton /> : <ConversationListSkeleton />}
      </AppSkeleton>
    )
  }
  if (page.id === 'not-found') return <PageNotFound />
  if (page.id === 'canvases' || page.id === 'shared' || page.id === 'trash') {
    const view =
      page.id === 'shared' ? 'shared' : page.id === 'trash' ? 'trash' : 'mine'
    const title =
      view === 'shared'
        ? 'Shared with me'
        : view === 'trash'
          ? 'Trash'
          : 'Canvases'
    return <AppSkeleton title={title} view={view} />
  }
  if (page.id === 'activity')
    return <AppSkeleton title="Agent activity" section="activity" />
  if (page.id === 'settings')
    return <AppSkeleton title="Settings" section="settings" />
  return <AppSkeleton />
}
