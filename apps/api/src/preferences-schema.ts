import { z } from 'zod'

export const preferencesSchema = z.object({
  homeDestination: z.enum(['dashboard', 'last-edited']),
  theme: z.enum(['light', 'dark', 'system']),
  showGrid: z.boolean(),
  snapToShapes: z.boolean(),
  openAssistant: z.boolean(),
})

export const defaultPreferences: z.infer<typeof preferencesSchema> = {
  homeDestination: 'dashboard',
  theme: 'system',
  showGrid: false,
  snapToShapes: false,
  openAssistant: false,
}
