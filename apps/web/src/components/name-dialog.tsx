import { useState } from 'react'
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
  const trimmed = name.trim()

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!trimmed || trimmed === initialName) return onDone()
        setPending(true)
        try {
          await onSubmit(trimmed)
          onDone()
        } finally {
          setPending(false)
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        placeholder={placeholder}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
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
