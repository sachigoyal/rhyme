import { TRPCError } from '@trpc/server'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { collaboratorRoles, schema } from '@rhyme/db'
import { fileProcedure, router } from '../trpc/init'

const { fileCollaborators, users } = schema

export const collaboratorsRouter = router({
  list: fileProcedure('viewer').query(({ ctx }) =>
    ctx.db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: fileCollaborators.role,
      })
      .from(fileCollaborators)
      .innerJoin(users, eq(users.id, fileCollaborators.userId))
      .where(eq(fileCollaborators.fileId, ctx.file.id))
      .orderBy(asc(users.email)),
  ),

  upsert: fileProcedure('owner')
    .input(
      z.object({
        email: z.email().trim().toLowerCase(),
        role: z.enum(collaboratorRoles),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invitee = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .get()

      if (!invitee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No Rhyme account uses that email yet.',
        })
      }
      if (invitee.id === ctx.file.ownerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'The owner already has access.',
        })
      }

      await ctx.db
        .insert(fileCollaborators)
        .values({
          fileId: ctx.file.id,
          userId: invitee.id,
          role: input.role,
          invitedById: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [fileCollaborators.fileId, fileCollaborators.userId],
          set: { role: input.role },
        })
    }),

  remove: fileProcedure('owner')
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(fileCollaborators)
        .where(
          and(
            eq(fileCollaborators.fileId, ctx.file.id),
            eq(fileCollaborators.userId, input.userId),
          ),
        )
    }),
})
