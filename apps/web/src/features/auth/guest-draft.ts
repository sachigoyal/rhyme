import { z } from 'zod'
import type { DocumentSnapshot } from '@rhyme/trpc-client'

const draftKey = 'rhyme:signup-draft'
const draftSchema = z.object({
  document: z.object({
    store: z.record(z.string(), z.unknown()),
    schema: z.record(z.string(), z.unknown()),
  }),
  fileId: z.string().optional(),
})

export const guestDraft = {
  get() {
    const raw = sessionStorage.getItem(draftKey)
    if (!raw) return null
    try {
      const result = draftSchema.safeParse(JSON.parse(raw))
      if (result.success) return result.data
    } catch {
      sessionStorage.removeItem(draftKey)
    }
    return null
  },
  set(document: DocumentSnapshot, fileId?: string) {
    sessionStorage.setItem(draftKey, JSON.stringify({ document, fileId }))
  },
  clear() {
    sessionStorage.removeItem(draftKey)
  },
}
