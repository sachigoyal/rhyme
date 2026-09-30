import { TRPCError, initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { z } from 'zod'
import type { FileRole } from '@rhyme/db'
import { getFileAccess, hasRole } from '../services/access'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  isDev: false,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      fieldErrors:
        error.cause instanceof z.ZodError
          ? z.flattenError(error.cause).fieldErrors
          : null,
    },
  }),
})

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const fileProcedure = (required: FileRole) =>
  protectedProcedure
    .input(z.object({ id: z.string() }))
    .use(async ({ ctx, input, next }) => {
      const access = await getFileAccess(ctx.db, input.id, ctx.user.id)
      if (!access) throw new TRPCError({ code: 'NOT_FOUND' })
      if (!hasRole(access.role, required)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return next({ ctx: { ...ctx, ...access } })
    })
