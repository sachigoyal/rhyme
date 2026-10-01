import type { UIMessage } from 'ai'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, gte, isNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '@rhyme/db'
import { transcriptMetadata } from '../agents/chat-metadata'
import { deletePrefix } from '../lib/storage'
import { getFileAccess, hasRole } from '../services/access'
import { ensureLegacyChats } from '../services/legacy-chats'
import { getCanvasAgent, getChatAccess } from '../services/chats'
import { protectedProcedure, router } from '../trpc/init'

const { chats, files, fileCollaborators, agentRuns, chatChanges } = schema

async function readMessages(agent: Awaited<ReturnType<typeof getCanvasAgent>>) {
  const response = await agent.fetch(
    new Request('https://agent.internal/history'),
  )
  if (!response.ok)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Could not load conversation',
    })
  const messages: unknown = await response.json()
  if (!Array.isArray(messages))
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
  return messages as UIMessage[]
}
const chatId = z.string().uuid()
const ownedChat = protectedProcedure
  .input(z.object({ id: chatId }))
  .use(async ({ ctx, input, next }) => {
    const access = await getChatAccess(ctx.db, input.id, ctx.user.id)
    return next({ ctx: { ...ctx, ...access } })
  })

const visibleChats = (userId: string) =>
  and(
    eq(chats.userId, userId),
    isNull(files.trashedAt),
    or(eq(files.ownerId, userId), eq(fileCollaborators.userId, userId)),
  )
const runTotals = {
  runCount: sql<number>`count(*)`.mapWith(Number).as('run_count'),
  errorCount:
    sql<number>`coalesce(sum(case when ${agentRuns.status} = 'error' then 1 else 0 end), 0)`
      .mapWith(Number)
      .as('error_count'),
  inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)`
    .mapWith(Number)
    .as('input_tokens'),
  outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)`
    .mapWith(Number)
    .as('output_tokens'),
  totalTokens: sql<number>`coalesce(sum(${agentRuns.totalTokens}), 0)`
    .mapWith(Number)
    .as('total_tokens'),
  durationMs: sql<number>`coalesce(sum(${agentRuns.durationMs}), 0)`
    .mapWith(Number)
    .as('duration_ms'),
}

export const chatsRouter = router({
  list: protectedProcedure
    .input(z.object({ fileId: z.string().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      await ensureLegacyChats(ctx.db, ctx.env, ctx.user.id, input.fileId)
      const totals = ctx.db
        .select({ chatId: agentRuns.chatId, ...runTotals })
        .from(agentRuns)
        .groupBy(agentRuns.chatId)
        .as('run_totals')
      const rows = await ctx.db
        .select({
          chat: chats,
          fileName: files.name,
          runCount: totals.runCount,
          errorCount: totals.errorCount,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          totalTokens: totals.totalTokens,
          durationMs: totals.durationMs,
        })
        .from(chats)
        .innerJoin(files, eq(files.id, chats.fileId))
        .leftJoin(
          fileCollaborators,
          and(
            eq(fileCollaborators.fileId, files.id),
            eq(fileCollaborators.userId, ctx.user.id),
          ),
        )
        .leftJoin(totals, eq(totals.chatId, chats.id))
        .where(
          and(
            visibleChats(ctx.user.id),
            input.fileId ? eq(chats.fileId, input.fileId) : undefined,
          ),
        )
        .orderBy(desc(chats.updatedAt))
        .limit(200)
      return rows.map(({ chat, ...row }) => ({
        ...chat,
        ...row,
        runCount: row.runCount ?? 0,
        errorCount: row.errorCount ?? 0,
        inputTokens: row.inputTokens ?? 0,
        outputTokens: row.outputTokens ?? 0,
        totalTokens: row.totalTokens ?? 0,
        durationMs: row.durationMs ?? 0,
      }))
    }),
  activity: protectedProcedure.query(async ({ ctx }) => {
    const totals = ctx.db
      .select({ chatId: agentRuns.chatId, ...runTotals })
      .from(agentRuns)
      .groupBy(agentRuns.chatId)
      .as('activity_totals')
    return ctx.db
      .select({
        id: chats.id,
        title: chats.title,
        updatedAt: chats.updatedAt,
        toolCallCount: chats.toolCallCount,
        totalTokens: sql<number>`coalesce(${totals.totalTokens}, 0)`.mapWith(
          Number,
        ),
        fileName: sql<string>`coalesce(${files.name}, 'Deleted canvas')`,
        available:
          sql<boolean>`case when ${files.id} is not null and ${files.trashedAt} is null and (${files.ownerId} = ${ctx.user.id} or ${fileCollaborators.userId} = ${ctx.user.id}) then 1 else 0 end`.mapWith(
            Boolean,
          ),
      })
      .from(chats)
      .leftJoin(files, eq(files.id, chats.fileId))
      .leftJoin(
        fileCollaborators,
        and(
          eq(fileCollaborators.fileId, files.id),
          eq(fileCollaborators.userId, ctx.user.id),
        ),
      )
      .leftJoin(totals, eq(totals.chatId, chats.id))
      .where(eq(chats.userId, ctx.user.id))
      .orderBy(desc(chats.updatedAt))
      .limit(8)
  }),
  get: ownedChat.query(async ({ ctx }) => {
    const agent = await getCanvasAgent(ctx.env, ctx.chat)
    const [messages, changes, totals] = await Promise.all([
      readMessages(agent),
      ctx.db
        .select()
        .from(chatChanges)
        .where(eq(chatChanges.chatId, ctx.chat.id))
        .orderBy(desc(chatChanges.createdAt))
        .limit(100),
      ctx.db
        .select(runTotals)
        .from(agentRuns)
        .where(eq(agentRuns.chatId, ctx.chat.id))
        .get(),
    ])
    const completed = new Map(
      transcriptMetadata(messages).changes.map((change) => [
        change.toolCallId,
        change.summary,
      ]),
    )
    return {
      chat: { ...ctx.chat, fileName: ctx.file.name, ...totals },
      messages,
      changes: changes.map(({ previewKey, ...change }) => ({
        ...change,
        summary: completed.get(change.toolCallId) ?? change.summary,
        previewUrl: previewKey
          ? `${ctx.env.API_URL}/chats/${ctx.chat.id}/changes/${change.id}/preview`
          : null,
      })),
    }
  }),
  create: protectedProcedure
    .input(z.object({ fileId: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const access = await getFileAccess(ctx.db, input.fileId, ctx.user.id)
      if (!access || access.file.trashedAt)
        throw new TRPCError({ code: 'NOT_FOUND' })
      if (!hasRole(access.role, 'editor'))
        throw new TRPCError({ code: 'FORBIDDEN' })
      await ensureLegacyChats(ctx.db, ctx.env, ctx.user.id, input.fileId)
      return ctx.db
        .insert(chats)
        .values({ fileId: input.fileId, userId: ctx.user.id })
        .returning()
        .get()
    }),
  rename: ownedChat
    .input(z.object({ title: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(chats)
        .set({ title: input.title, titleSource: 'manual' })
        .where(eq(chats.id, ctx.chat.id))
    }),
  delete: ownedChat.mutation(async ({ ctx }) => {
    const agent = await getCanvasAgent(ctx.env, ctx.chat)
    const removed = await ctx.db
      .delete(chats)
      .where(and(eq(chats.id, ctx.chat.id), ne(chats.status, 'running')))
      .returning({ id: chats.id })
      .get()
    if (!removed)
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'Wait for the assistant to finish before deleting this conversation',
      })
    await agent.fetch(
      new Request('https://agent.internal/remove', { method: 'DELETE' }),
    )
    ctx.waitUntil(
      deletePrefix(
        ctx.env.STORAGE,
        `files/${ctx.chat.fileId}/chats/${ctx.chat.id}/`,
      ),
    )
  }),
  recordChange: ownedChat
    .input(
      z.object({
        toolCallId: z.string().min(1).max(128),
        summary: z.string().max(240).optional(),
        preview: z
          .string()
          .max(500_000)
          .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!hasRole(ctx.role, 'editor'))
        throw new TRPCError({ code: 'FORBIDDEN' })
      const tool = await ctx.db
        .select()
        .from(chatChanges)
        .where(
          and(
            eq(chatChanges.chatId, ctx.chat.id),
            eq(chatChanges.toolCallId, input.toolCallId),
          ),
        )
        .get()
      if (!tool)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Canvas action not found in this conversation',
        })
      const agent = await getCanvasAgent(ctx.env, ctx.chat)
      const completed = transcriptMetadata(
        await readMessages(agent),
      ).changes.find((change) => change.toolCallId === input.toolCallId)
      if (!completed || completed.applied === 0)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Canvas action has not completed successfully',
        })
      const previewUrl = `${ctx.env.API_URL}/chats/${ctx.chat.id}/changes/${tool.id}/preview`
      if (tool.previewKey) return { previewUrl }
      const key = `files/${ctx.chat.fileId}/chats/${ctx.chat.id}/${crypto.randomUUID()}.jpg`
      const [header, data = ''] = input.preview.split(',')
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
      await ctx.env.STORAGE.put(key, bytes, {
        httpMetadata: {
          contentType: header!.includes('png') ? 'image/png' : 'image/jpeg',
        },
      })
      const saved = await ctx.db
        .update(chatChanges)
        .set({ previewKey: key, summary: completed.summary })
        .where(and(eq(chatChanges.id, tool.id), isNull(chatChanges.previewKey)))
        .returning({ id: chatChanges.id })
        .get()
      if (!saved) ctx.waitUntil(ctx.env.STORAGE.delete(key))
      return { previewUrl }
    }),
  analytics: protectedProcedure
    .input(
      z
        .object({
          days: z
            .union([z.literal(7), z.literal(30), z.literal(90)])
            .default(30),
        })
        .default({ days: 30 }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000)
      const rows = await ctx.db
        .select({
          ...runTotals,
          toolCallCount:
            sql<number>`coalesce(sum(${agentRuns.toolCallCount}), 0)`.mapWith(
              Number,
            ),
        })
        .from(agentRuns)
        .innerJoin(chats, eq(chats.id, agentRuns.chatId))
        .where(
          and(eq(chats.userId, ctx.user.id), gte(agentRuns.createdAt, since)),
        )
        .get()
      const conversationCount = await ctx.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(chats)
        .where(eq(chats.userId, ctx.user.id))
        .get()
      return {
        ...rows!,
        conversationCount: conversationCount?.count ?? 0,
        days: input.days,
        averageDurationMs: rows?.runCount
          ? Math.round(rows.durationMs / rows.runCount)
          : 0,
      }
    }),
})
