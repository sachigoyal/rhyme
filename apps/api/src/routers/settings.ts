import { eq } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import { defaultPreferences, preferencesSchema } from '../preferences-schema'
import { protectedProcedure, router } from '../trpc/init'

const { userSettings } = schema

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const saved = await ctx.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, ctx.user.id))
      .get()
    return {
      ...(saved ? preferencesSchema.parse(saved) : defaultPreferences),
      lastEditedCanvasId: saved?.lastEditedCanvasId ?? null,
    }
  }),
  update: protectedProcedure
    .input(
      preferencesSchema
        .partial()
        .refine(
          (input) => Object.keys(input).length > 0,
          'Choose a preference to update.',
        ),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userSettings)
        .values({ userId: ctx.user.id, ...defaultPreferences, ...input })
        .onConflictDoUpdate({ target: userSettings.userId, set: input })
      return input
    }),
})
