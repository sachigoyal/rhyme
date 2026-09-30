import { eq } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import { profileSchema } from '../profile-schema'
import { protectedProcedure, router } from '../trpc/init'

const { userProfiles, users } = schema

export const profileRouter = router({
  get: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.user.id))
      .get()
      .then((profile) => profile ?? null),
  ),
  complete: protectedProcedure
    .input(profileSchema)
    .mutation(async ({ ctx, input }) => {
      const { name, ...answers } = input
      const completedAt = new Date()
      await ctx.db.batch([
        ctx.db.update(users).set({ name }).where(eq(users.id, ctx.user.id)),
        ctx.db
          .insert(userProfiles)
          .values({ userId: ctx.user.id, ...answers, completedAt })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: { ...answers, completedAt },
          }),
      ])
      return { completedAt }
    }),
})
