import { z } from 'zod'
import type { DocumentSnapshot } from '@rhyme/trpc-client'

const draftKey = 'rhyme:signup-draft'
const draftSchema = z.object({
  document: z.object({
    store: z.record(z.string(), z.unknown()),
    schema: z.record(z.string(), z.unknown()),
  }),
  id: z.string().uuid().optional(),
  import: z
    .object({ userId: z.string(), fileId: z.string().uuid() })
    .optional(),
})

export function hasGuestContent(document: DocumentSnapshot) {
  return Object.values(document.store).some(
    (record) =>
      typeof record === 'object' &&
      record !== null &&
      'typeName' in record &&
      record.typeName === 'shape',
  )
}

export const guestDraft = {
  get() {
    try {
      const raw =
        localStorage.getItem(draftKey) ?? sessionStorage.getItem(draftKey)
      if (!raw) return null
      const result = draftSchema.safeParse(JSON.parse(raw))
      if (!result.success) return null
      const draft = {
        ...result.data,
        id: result.data.id ?? crypto.randomUUID(),
      }
      if (!result.data.id || !localStorage.getItem(draftKey)) {
        try {
          localStorage.setItem(draftKey, JSON.stringify(draft))
          sessionStorage.removeItem(draftKey)
        } catch {
          return draft
        }
      }
      return draft
    } catch {
      return null
    }
  },
  set(document: DocumentSnapshot) {
    const previous = this.get()
    const draft = {
      document,
      id: previous && !previous.import ? previous.id : crypto.randomUUID(),
    }
    localStorage.setItem(draftKey, JSON.stringify(draft))
    return draft
  },
  claim(userId: string) {
    const draft = this.get()
    if (!draft) return null
    if (!hasGuestContent(draft.document)) {
      this.clear(draft.id)
      return null
    }
    if (draft.import && draft.import.userId !== userId)
      throw new Error('Sign in to the account that started saving this canvas.')
    const claimed = {
      ...draft,
      import: draft.import ?? { userId, fileId: crypto.randomUUID() },
    }
    localStorage.setItem(draftKey, JSON.stringify(claimed))
    return claimed
  },
  clear(id: string) {
    if (this.get()?.id !== id) return
    localStorage.removeItem(draftKey)
    sessionStorage.removeItem(draftKey)
  },
}
