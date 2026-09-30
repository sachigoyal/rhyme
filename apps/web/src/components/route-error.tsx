import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@rhyme/ui/components/button'
import { RecoveryPage, RecoveryState } from './recovery-state'

export function RouteError({ reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <RecoveryPage>
      <RecoveryState
        title="Unable to load page"
        description="Try again. If the problem continues, return to your canvases."
        onRetry={async () => {
          await router.invalidate()
          reset()
        }}
      >
        <Button asChild variant="outline">
          <Link to="/files" search={{ view: 'mine' }}>
            View canvases
          </Link>
        </Button>
      </RecoveryState>
    </RecoveryPage>
  )
}
