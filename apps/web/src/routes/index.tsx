import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { GuestCanvas } from '@/features/auth/guest-canvas'
import { useOpenRecentCanvas } from '@/features/auth/use-open-recent-canvas'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: async ({ context }) => ({
    session: await context.queryClient.ensureQueryData(sessionQuery),
  }),
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  return session ? <OpenRecentCanvas /> : <GuestCanvas />
}

function OpenRecentCanvas() {
  const error = useOpenRecentCanvas()
  return (
    <main className="grid h-svh place-items-center p-6">
      {error ? (
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-medium">Couldn’t open your canvas</h1>
          <p className="text-muted-foreground text-sm">{error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Opening your canvas…
        </div>
      )}
    </main>
  )
}
