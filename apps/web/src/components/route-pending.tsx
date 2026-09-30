import { useRouterState } from '@tanstack/react-router'
import { getSeoPage } from '@/lib/seo'
import {
  AppSkeleton,
  CanvasSkeleton,
  GuestCanvasSkeleton,
} from './loading-states'
import { PageNotFound } from './recovery-state'

export function RoutePending() {
  const href = useRouterState({ select: (state) => state.location.href })
  const page = getSeoPage(href)
  if (page.id === 'home') return <GuestCanvasSkeleton />
  if (page.id === 'canvas') return <CanvasSkeleton />
  if (page.id === 'not-found') return <PageNotFound />
  return <AppSkeleton />
}
