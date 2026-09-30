import { createFileRoute, redirect } from '@tanstack/react-router'
import { BrandLoading } from '@/components/brand-loading'
import { lazy, Suspense } from 'react'
import { guestDraft } from '@/features/auth/guest-draft'
import { lastEditedCanvas } from '@/features/auth/home-destination'
import { sessionQuery } from '@/lib/auth'

const GuestCanvas = lazy(() =>
  import('@/features/auth/guest-canvas').then((module) => ({
    default: module.GuestCanvas,
  })),
)

export const Route = createFileRoute('/')({
  ssr: false,
  pendingComponent: BrandLoading,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) return
    if (guestDraft.get()) throw redirect({ to: '/auth/complete' })
    const [profile, settings] = await Promise.all([
      context.queryClient.ensureQueryData(
        context.trpc.profile.get.queryOptions(),
      ),
      context.queryClient.ensureQueryData(
        context.trpc.settings.get.queryOptions(undefined, {
          staleTime: 5 * 60 * 1000,
        }),
      ),
    ])
    if (!profile) throw redirect({ to: '/onboarding' })
    if (settings.homeDestination === 'last-edited') {
      if (settings.lastEditedCanvasId) {
        const file = await context.queryClient
          .fetchQuery(
            context.trpc.files.get.queryOptions({
              id: settings.lastEditedCanvasId,
            }),
          )
          .catch(() => null)
        if (file && !file.trashedAt && file.role !== 'viewer')
          throw redirect({ to: '/files/$fileId', params: { fileId: file.id } })
        throw redirect({ to: '/files' })
      }
      const [mine, shared] = await Promise.all([
        context.queryClient.fetchQuery(
          context.trpc.files.list.queryOptions({
            view: 'mine',
            folderId: undefined,
          }),
        ),
        context.queryClient.fetchQuery(
          context.trpc.files.list.queryOptions({
            view: 'shared',
            folderId: undefined,
          }),
        ),
      ])
      const fileId = lastEditedCanvas([...mine, ...shared], session.user.id)
      if (fileId) throw redirect({ to: '/files/$fileId', params: { fileId } })
    }
    throw redirect({ to: '/files' })
  },
  component: () => (
    <Suspense fallback={<BrandLoading />}>
      <GuestCanvas />
    </Suspense>
  ),
})
