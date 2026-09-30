import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useRenameFile } from '@rhyme/hooks/mutations'
import { Input } from '@rhyme/ui/components/input'

export function FileTitle({
  id,
  name,
  editable,
}: {
  id: string
  name: string
  editable: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelCommit = useRef(false)
  const renameFile = useRenameFile()

  if (!editable)
    return <h1 className="truncate px-2 text-sm font-medium">{name}</h1>

  const commit = () => {
    const next = draft?.trim()
    setDraft(null)
    if (cancelCommit.current) {
      cancelCommit.current = false
      return
    }
    if (next && next !== name) {
      renameFile.mutate(
        { id, name: next },
        { onError: () => toast.error('Unable to rename canvas') },
      )
    }
  }

  return (
    <Input
      aria-label="Canvas name"
      value={draft ?? name}
      maxLength={120}
      onFocus={(event) => {
        cancelCommit.current = false
        setDraft(name)
        event.target.select()
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelCommit.current = true
          event.currentTarget.blur()
        }
      }}
      className="hover:border-input focus-visible:border-input h-8 w-auto max-w-72 min-w-24 truncate border-transparent bg-transparent px-2 text-sm font-medium shadow-none dark:bg-transparent"
      style={{ width: `${Math.max((draft ?? name).length, 8) + 3}ch` }}
    />
  )
}
