import { z } from 'zod'

export const onboardingSteps = [
  'name',
  'role',
  'useCases',
  'teamSize',
  'referral',
  'analyticsConsent',
] as const
const draftSchema = z.object({
  step: z.enum(onboardingSteps),
  answers: z.object({
    name: z.string().max(80),
    role: z
      .enum(['design', 'engineering', 'product', 'education', 'other'])
      .nullable(),
    useCases: z
      .array(
        z.enum([
          'brainstorming',
          'diagrams',
          'wireframes',
          'planning',
          'teaching',
        ]),
      )
      .max(5),
    teamSize: z.enum(['solo', '2-10', '11-50', '51+']).nullable(),
    referral: z.enum(['friend', 'search', 'social', 'other']).nullable(),
    analyticsConsent: z.enum(['yes', 'no']).nullable(),
  }),
})
export type OnboardingDraft = z.infer<typeof draftSchema>

const key = (userId: string) => `rhyme:onboarding:${userId}`
export const onboardingDraft = {
  get(userId: string, name: string): OnboardingDraft {
    try {
      const raw = localStorage.getItem(key(userId))
      const result = raw && draftSchema.safeParse(JSON.parse(raw))
      if (result && result.success) return result.data
    } catch {
      // The form remains usable when browser storage is unavailable.
    }
    return {
      step: 'name',
      answers: {
        name,
        role: null,
        useCases: [],
        teamSize: null,
        referral: null,
        analyticsConsent: null,
      },
    }
  },
  set(userId: string, draft: OnboardingDraft) {
    localStorage.setItem(key(userId), JSON.stringify(draft))
  },
  clear(userId: string) {
    try {
      localStorage.removeItem(key(userId))
    } catch {
      /* Storage may be disabled. */
    }
  },
}
