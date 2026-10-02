import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { AppSkeleton } from '@/components/loading-states'
import { useProfile } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import { authSearch } from '@/features/auth/redirect'
import { useImportGuestDraft } from '@/features/auth/use-import-guest-draft'
import { authClient, sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/auth/complete')({
  ssr: false,
  validateSearch: authSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery)
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
  const { redirect: next } = Route.useSearch()
  const profile = useProfile()
  const imported = useImportGuestDraft(user.id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [switchError, setSwitchError] = useState<Error | null>(null)
  const [switching, setSwitching] = useState(false)
  const switchAccount = async () => {
    setSwitching(true)
    try {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message ?? 'Unable to sign out.')
      await queryClient.cancelQueries()
      queryClient.clear()
      await navigate({
        to: '/sign-in',
        search: { redirect: next },
        replace: true,
      })
    } catch (cause) {
      setSwitchError(
        cause instanceof Error ? cause : new Error('Unable to sign out.'),
      )
    } finally {
      setSwitching(false)
    }
  }
  useEffect(() => {
    if (!imported.ready || profile.data === undefined || profile.isFetching)
      return
    if (profile.error || imported.error) return
    if (profile.data) void navigate({ href: next ?? '/files', replace: true })
    else
      void navigate({
        to: '/onboarding',
        search: { redirect: next },
        replace: true,
      })
  }, [
    imported.ready,
    imported.error,
    profile.data,
    profile.error,
    profile.isFetching,
    next,
    navigate,
  ])
  const error = switchError ?? imported.error ?? profile.error
  if (!error) return <AppSkeleton />
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-medium">Unable to finish sign-in</h1>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        {imported.error && (
          <p className="text-muted-foreground text-xs">
            Your guest canvas is still saved on this device.
          </p>
        )}
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
        <Button
          variant="ghost"
          disabled={switching}
          onClick={() => void switchAccount()}
        >
          Use another account
        </Button>
      </div>
    </main>
  )
}
