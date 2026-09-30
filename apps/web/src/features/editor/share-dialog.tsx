import { useState } from 'react'
import { Loader2, Share2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useRemoveCollaborator,
  useUpsertCollaborator,
} from '@rhyme/hooks/mutations'
import { useCollaborators } from '@rhyme/hooks/queries'
import type { Collaborator } from '@rhyme/trpc-client'
import { Button } from '@rhyme/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@rhyme/ui/components/dialog'
import { Input } from '@rhyme/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rhyme/ui/components/select'
import { Skeleton } from '@rhyme/ui/components/skeleton'

type Role = Collaborator['role']

function RoleSelect({
  value,
  onChange,
}: {
  value: Role
  onChange: (role: Role) => void
}) {
  return (
    <Select value={value} onValueChange={(role) => onChange(role as Role)}>
      <SelectTrigger size="sm" className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="viewer">Viewer</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function ShareDialog({
  fileId,
  fileName,
}: {
  fileId: string
  fileName: string
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const { data: collaborators, isPending } = useCollaborators(fileId, open)
  const upsert = useUpsertCollaborator()
  const remove = useRemoveCollaborator()

  const invite = (event: React.FormEvent) => {
    event.preventDefault()
    upsert.mutate(
      { id: fileId, email, role },
      {
        onSuccess: () => {
          toast.success(`Shared with ${email}`)
          setEmail('')
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{fileName}”</DialogTitle>
          <DialogDescription>
            People you invite need a Rhyme account with that email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={invite} className="flex gap-2">
          <Input
            type="email"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <RoleSelect value={role} onChange={setRole} />
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="animate-spin" />}
            Invite
          </Button>
        </form>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            People with access
          </p>
          {isPending && <Skeleton className="h-10 w-full" />}
          {collaborators?.length === 0 && (
            <p className="text-muted-foreground py-3 text-sm">
              Only you can see this file.
            </p>
          )}
          {collaborators?.map((person) => (
            <div key={person.userId} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {person.name || person.email}
                </p>
                {person.name && (
                  <p className="text-muted-foreground truncate text-xs">
                    {person.email}
                  </p>
                )}
              </div>
              <RoleSelect
                value={person.role}
                onChange={(next) =>
                  upsert.mutate({ id: fileId, email: person.email, role: next })
                }
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${person.email}`}
                onClick={() =>
                  remove.mutate({ id: fileId, userId: person.userId })
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
