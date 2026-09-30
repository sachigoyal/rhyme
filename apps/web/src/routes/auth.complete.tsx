import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useFiles, useProfile } from '@rhyme/hooks/queries'
import { Button } from '@rhyme/ui/components/button'
import { authSearch } from '@/features/auth/redirect'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/auth/complete')({
  ssr: false,
  validateSearch: authSearch,
  beforeLoad: async ({ context, search }) => {
    if (!(await context.queryClient.ensureQueryData(sessionQuery))) {
      throw redirect({ to: '/sign-in', search })
    }
  },
  component: CompleteSignIn,
})

function CompleteSignIn() {
  const { redirect: next } = Route.useSearch()
  const files = useFiles()
  const shared = useFiles({ view: 'shared' })
  const profile = useProfile()
  const navigate = useNavigate()
  useEffect(() => {
    if (!files.data || !shared.data || profile.data === undefined) return
    if (!profile.data && !files.data.length && !shared.data.length) {
      void navigate({ to: '/onboarding', search: { redirect: next } })
    } else {
      void navigate({ href: next ?? '/' })
    }
  }, [files.data, shared.data, profile.data, navigate, next])
  const error = files.error ?? shared.error ?? profile.error
  return (
    <main className="grid min-h-svh place-items-center p-6">
      {error ? (
        <div className="space-y-4 text-center">
          <p className="text-sm">{error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <Loader2
          aria-label="Preparing your workspace"
          className="text-muted-foreground size-5 animate-spin"
        />
      )}
    </main>
  )
}
