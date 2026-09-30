import { useState } from 'react'
import { Button } from '@rhyme/ui/components/button'

export function RefreshNotice({
  onRetry,
}: {
  onRetry: () => Promise<unknown>
}) {
  const [pending, setPending] = useState(false)
  const retry = async () => {
    if (pending) return
    setPending(true)
    try {
      await onRetry().catch(() => undefined)
    } finally {
      setPending(false)
    }
  }
  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
      role="status"
    >
      <p className="text-muted-foreground text-sm">
        Couldn’t refresh. Showing previously loaded data.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => void retry()}
      >
        {pending ? 'Refreshing…' : 'Try again'}
      </Button>
    </div>
  )
}
