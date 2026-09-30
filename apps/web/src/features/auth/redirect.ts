import { z } from 'zod'

export const authSearch = z.object({
  redirect: z
    .string()
    .max(2048)
    .refine(
      (value) =>
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !value.includes('\\'),
      'Invalid redirect',
    )
    .optional(),
})
