import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@rhyme/ui/components/alert-dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changeOpen = (next: boolean) => {
    if (pending) return
    setError(null)
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={async (event) => {
              event.preventDefault()
              if (pending) return
              setPending(true)
              setError(null)
              try {
                await onConfirm()
                onOpenChange(false)
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : 'Unable to complete this action. Try again.',
                )
              } finally {
                setPending(false)
              }
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
