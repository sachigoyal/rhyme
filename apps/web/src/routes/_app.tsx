import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { AppSkeleton } from '@/components/loading-states'
import { AccountPreferences } from '@/features/settings/account-preferences'
import { guestDraft } from '@/features/auth/guest-draft'
import { sessionQuery } from '@/lib/auth'

const WorkspaceNotFound = lazy(
  () => import('@/features/files/workspace-not-found'),
)

export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery)
    if (!session) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    const [profile] = await Promise.all([
      context.queryClient.ensureQueryData(
        context.trpc.profile.get.queryOptions(),
      ),
      context.queryClient.ensureQueryData(
        context.trpc.settings.get.queryOptions(undefined, {
          staleTime: 5 * 60 * 1000,
        }),
      ),
    ])
    if (!profile || guestDraft.get())
      throw redirect({
        to: '/auth/complete',
        search: { redirect: location.href },
      })
    return { user: session.user }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      context.trpc.folders.list.queryOptions(),
    )
    void context.queryClient.prefetchQuery(
      context.trpc.chats.list.queryOptions({}, { staleTime: 5000 }),
    )
  },
  notFoundComponent: () => (
    <Suspense fallback={<AppSkeleton />}>
      <WorkspaceNotFound />
    </Suspense>
  ),
  component: () => (
    <AccountPreferences>
      <Outlet />
    </AccountPreferences>
  ),
})
