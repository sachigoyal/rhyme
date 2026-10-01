import { and, eq } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { connectionInputSchema } from '../byok-schema'
import { protectedProcedure, router } from '../trpc/init'
import {
  connectionKey,
  getAIConnection,
  testAIConnection,
} from '../services/ai-connections'
import { encryptProviderKey } from '../services/provider-keys'
import { providerError } from '../services/provider-errors'

const { aiConnections } = schema
const publicColumns = {
  id: aiConnections.id,
  name: aiConnections.name,
  provider: aiConnections.provider,
  baseUrl: aiConnections.baseUrl,
  models: aiConnections.models,
  vision: aiConnections.vision,
  keyHint: aiConnections.keyHint,
}

export const aiConnectionsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select(publicColumns)
      .from(aiConnections)
      .where(eq(aiConnections.userId, ctx.user.id))
      .orderBy(aiConnections.createdAt),
  ),
  test: protectedProcedure
    .input(connectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = input.id
          ? await getAIConnection(ctx.db, ctx.user.id, input.id)
          : null
        if (existing && input.provider !== existing.provider && !input.apiKey)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Enter a new API key when changing providers.',
          })
        const key =
          input.apiKey ??
          (existing ? await connectionKey(existing, ctx.env) : '')
        return await testAIConnection(input, key)
      } catch (error) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: providerError(error).message,
        })
      }
    }),
  save: protectedProcedure
    .input(connectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = input.id
          ? await getAIConnection(ctx.db, ctx.user.id, input.id)
          : null
        if (existing && input.provider !== existing.provider && !input.apiKey)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Enter a new API key when changing providers.',
          })
        const key =
          input.apiKey ??
          (existing ? await connectionKey(existing, ctx.env) : '')
        await testAIConnection(input, key)
        const id = existing?.id ?? crypto.randomUUID()
        const encryptedApiKey = await encryptProviderKey(
          key,
          ctx.env.BYOK_ENCRYPTION_KEY || ctx.env.BETTER_AUTH_SECRET,
          `${ctx.user.id}:${id}`,
        )
        const values = {
          name: input.name,
          provider: input.provider,
          baseUrl: input.baseUrl,
          models: input.models,
          vision: input.vision,
          encryptedApiKey,
          keyHint: key.slice(-4),
        }
        if (existing)
          await ctx.db
            .update(aiConnections)
            .set(values)
            .where(
              and(
                eq(aiConnections.id, id),
                eq(aiConnections.userId, ctx.user.id),
              ),
            )
        else
          await ctx.db
            .insert(aiConnections)
            .values({ id, userId: ctx.user.id, ...values })
        return ctx.db
          .select(publicColumns)
          .from(aiConnections)
          .where(
            and(
              eq(aiConnections.id, id),
              eq(aiConnections.userId, ctx.user.id),
            ),
          )
          .get()
      } catch (error) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: providerError(error).message,
        })
      }
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(aiConnections)
        .where(
          and(
            eq(aiConnections.id, input.id),
            eq(aiConnections.userId, ctx.user.id),
          ),
        )
      return { success: true }
    }),
})
