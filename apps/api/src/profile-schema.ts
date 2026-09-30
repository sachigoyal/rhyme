import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
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
  analyticsConsent: z.boolean(),
})
