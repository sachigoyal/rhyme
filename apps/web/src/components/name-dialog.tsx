import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@rhyme/ui/components/dialog'
import { Input } from '@rhyme/ui/components/input'
import { Label } from '@rhyme/ui/components/label'

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  initialName?: string
  placeholder?: string
  submitLabel: string
  onSubmit: (name: string) => Promise<unknown>
}

export function NameDialog({ open, onOpenChange, ...props }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open && <NameForm {...props} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  description,
  initialName = '',
  placeholder,
  submitLabel,
  onSubmit,
  onDone,
}: Omit<NameDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const [name, setName] = useState(initialName)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const trimmed = name.trim()

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (pending || !trimmed) return
        if (trimmed === initialName) return onDone()
        setPending(true)
        setError(null)
        try {
          await onSubmit(trimmed)
          onDone()
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Unable to save the name. Try again.',
          )
        } finally {
          setPending(false)
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className={description ? undefined : 'sr-only'}>
          {description ?? 'Enter a name.'}
        </DialogDescription>
      </DialogHeader>
      <Label htmlFor={inputId} className="sr-only">
        {placeholder ?? title}
      </Label>
      <Input
        id={inputId}
        autoFocus
        disabled={pending}
        value={name}
        placeholder={placeholder}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed || pending}>
          {pending && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
