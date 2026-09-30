import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AppSkeleton } from '@/components/loading-states'
import { useProfile } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import { authSearch } from '@/features/auth/redirect'
import { useImportGuestDraft } from '@/features/auth/use-import-guest-draft'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/auth/complete')({
  ssr: false,
  validateSearch: authSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) throw redirect({ to: '/sign-in', search })
    return { user: session.user }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      context.trpc.profile.get.queryOptions(),
    )
    void context.queryClient.prefetchQuery(
      context.trpc.files.list.queryOptions({
        view: 'mine',
        folderId: undefined,
      }),
    )
  },
  component: CompleteSignIn,
})

function CompleteSignIn() {
  const { user } = Route.useRouteContext()
  const profile = useProfile()
  const imported = useImportGuestDraft(user.id)
  const navigate = useNavigate()
  useEffect(() => {
    if (!imported.ready || profile.data === undefined || profile.isFetching)
      return
    void navigate({
      to: profile.data ? '/files' : '/onboarding',
      replace: true,
    })
  }, [imported.ready, profile.data, profile.isFetching, navigate])
  const error = imported.error ?? profile.error
  if (!error) return <AppSkeleton />
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-medium">Unable to finish sign-in</h1>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <p className="text-muted-foreground text-xs">
          Your guest canvas is still saved on this device.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </main>
  )
}
