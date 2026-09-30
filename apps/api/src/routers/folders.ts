import { TRPCError } from '@trpc/server'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '@rhyme/db'
import { isFolderOwner } from '../services/access'
import { protectedProcedure, router } from '../trpc/init'

const { folders } = schema

const folderName = z.string().trim().min(1).max(80)

const ownedFolder = protectedProcedure
  .input(z.object({ id: z.string() }))
  .use(async ({ ctx, input, next }) => {
    if (!(await isFolderOwner(ctx.db, input.id, ctx.user.id))) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    return next()
  })

export const foldersRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: folders.id,
        name: folders.name,
        parentId: folders.parentId,
        createdAt: folders.createdAt,
      })
      .from(folders)
      .where(eq(folders.ownerId, ctx.user.id))
      .orderBy(asc(folders.name)),
  ),

  create: protectedProcedure
    .input(z.object({ name: folderName, parentId: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      if (
        input.parentId &&
        !(await isFolderOwner(ctx.db, input.parentId, ctx.user.id))
      ) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' })
      }
      return ctx.db
        .insert(folders)
        .values({
          ownerId: ctx.user.id,
          parentId: input.parentId ?? null,
          name: input.name,
        })
        .returning({ id: folders.id, name: folders.name })
        .get()
    }),

  rename: ownedFolder
    .input(z.object({ name: folderName }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(folders)
        .set({ name: input.name })
        .where(eq(folders.id, input.id))
    }),

  // Subfolders cascade; files inside fall back to the root.
  delete: ownedFolder.mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(folders)
      .where(and(eq(folders.id, input.id), eq(folders.ownerId, ctx.user.id)))
  }),
})
