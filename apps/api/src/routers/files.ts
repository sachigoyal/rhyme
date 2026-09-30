import { TRPCError } from '@trpc/server'
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '@rhyme/db'
import type { Database, File, FileRole } from '@rhyme/db'
import { isFolderOwner } from '../services/access'
import { deleteFileChatStorage } from '../services/chats'
import { deletePrefix, objectKeys, readJson, writeJson } from '../lib/storage'
import { fileProcedure, protectedProcedure, router } from '../trpc/init'

const { fileCollaborators, files, users } = schema

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

const fileName = z.string().trim().min(1).max(120)

// Mirrors tldraw's TLStoreSnapshot.
const documentSnapshot = z.object({
  store: z.record(z.string(), z.unknown()),
  schema: z.record(z.string(), z.unknown()),
})

export type DocumentSnapshot = z.infer<typeof documentSnapshot>

const listInput = z
  .object({
    view: z.enum(['mine', 'shared', 'trash']).default('mine'),
    folderId: z.string().nullish(),
  })
  .default({ view: 'mine' })

const summaryColumns = {
  id: files.id,
  name: files.name,
  folderId: files.folderId,
  version: files.version,
  thumbnailKey: files.thumbnailKey,
  createdAt: files.createdAt,
  updatedAt: files.updatedAt,
  trashedAt: files.trashedAt,
  owner: { id: users.id, name: users.name, email: users.email },
}

type SummarySource = Pick<
  File,
  | 'id'
  | 'name'
  | 'folderId'
  | 'version'
  | 'thumbnailKey'
  | 'createdAt'
  | 'updatedAt'
  | 'trashedAt'
> & { owner: { id: string; name: string; email: string } }

function toSummary({ thumbnailKey, ...file }: SummarySource, role: FileRole) {
  return {
    id: file.id,
    name: file.name,
    folderId: file.folderId,
    version: file.version,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    trashedAt: file.trashedAt,
    owner: file.owner,
    role,
    hasThumbnail: thumbnailKey !== null,
  }
}

async function assertFolder(
  db: Database,
  userId: string,
  folderId: string | null | undefined,
) {
  if (folderId && !(await isFolderOwner(db, folderId, userId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' })
  }
}

export const filesRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const me = ctx.user.id
    const where = {
      mine: and(
        eq(files.ownerId, me),
        isNull(files.trashedAt),
        input.folderId === undefined
          ? undefined
          : input.folderId === null
            ? isNull(files.folderId)
            : eq(files.folderId, input.folderId),
      ),
      shared: and(isNotNull(fileCollaborators.userId), isNull(files.trashedAt)),
      trash: and(eq(files.ownerId, me), isNotNull(files.trashedAt)),
    }[input.view]

    const rows = await ctx.db
      .select({ ...summaryColumns, role: fileCollaborators.role })
      .from(files)
      .innerJoin(users, eq(users.id, files.ownerId))
      .leftJoin(
        fileCollaborators,
        and(
          eq(fileCollaborators.fileId, files.id),
          eq(fileCollaborators.userId, me),
        ),
      )
      .where(where)
      .orderBy(
        input.view === 'trash' ? desc(files.trashedAt) : desc(files.updatedAt),
      )

    return rows.map(({ role, ...row }) =>
      toSummary(row, row.owner.id === me ? 'owner' : (role ?? 'viewer')),
    )
  }),

  get: fileProcedure('viewer').query(async ({ ctx }) => {
    const owner = await ctx.db
      .select(summaryColumns.owner)
      .from(users)
      .where(eq(users.id, ctx.file.ownerId))
      .get()
    if (!owner) throw new TRPCError({ code: 'NOT_FOUND' })
    return toSummary({ ...ctx.file, owner }, ctx.role)
  }),

  create: protectedProcedure
    .input(
      z
        .object({ name: fileName.optional(), folderId: z.string().nullish() })
        .default({}),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFolder(ctx.db, ctx.user.id, input.folderId)
      return ctx.db
        .insert(files)
        .values({
          ownerId: ctx.user.id,
          folderId: input.folderId ?? null,
          name: input.name ?? 'Untitled',
        })
        .returning({ id: files.id, name: files.name })
        .get()
    }),

  rename: fileProcedure('editor')
    .input(z.object({ name: fileName }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(files)
        .set({ name: input.name })
        .where(eq(files.id, ctx.file.id))
    }),

  move: fileProcedure('owner')
    .input(z.object({ folderId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await assertFolder(ctx.db, ctx.user.id, input.folderId)
      await ctx.db
        .update(files)
        .set({ folderId: input.folderId })
        .where(eq(files.id, ctx.file.id))
    }),

  trash: fileProcedure('owner').mutation(async ({ ctx }) => {
    await ctx.db
      .update(files)
      .set({ trashedAt: new Date() })
      .where(eq(files.id, ctx.file.id))
  }),

  restore: fileProcedure('owner').mutation(async ({ ctx }) => {
    await ctx.db
      .update(files)
      .set({ trashedAt: null })
      .where(eq(files.id, ctx.file.id))
  }),

  destroy: fileProcedure('owner').mutation(async ({ ctx }) => {
    const [conversations, importedUsers, collaborators] = await Promise.all([
      ctx.db
        .select({ id: schema.chats.id, userId: schema.chats.userId })
        .from(schema.chats)
        .where(eq(schema.chats.fileId, ctx.file.id)),
      ctx.db
        .select({ userId: schema.legacyChatImports.userId })
        .from(schema.legacyChatImports)
        .where(eq(schema.legacyChatImports.fileId, ctx.file.id)),
      ctx.db
        .select({ userId: fileCollaborators.userId })
        .from(fileCollaborators)
        .where(eq(fileCollaborators.fileId, ctx.file.id)),
    ])
    const legacyUsers = [
      ctx.file.ownerId,
      ...conversations.map((chat) => chat.userId),
      ...importedUsers.map((user) => user.userId),
      ...collaborators.map((user) => user.userId),
    ]
    if (ctx.file.lastEditedById) legacyUsers.push(ctx.file.lastEditedById)
    await ctx.db.delete(files).where(eq(files.id, ctx.file.id))
    ctx.waitUntil(
      Promise.all([
        deletePrefix(ctx.env.STORAGE, objectKeys.file(ctx.file.id)),
        deleteFileChatStorage(ctx.env, ctx.file.id, conversations, legacyUsers),
      ]),
    )
  }),

  document: fileProcedure('viewer').query(async ({ ctx }) => {
    const { documentKey, version } = ctx.file
    const document = documentKey
      ? await readJson<DocumentSnapshot>(ctx.env.STORAGE, documentKey)
      : null
    return { version, document }
  }),

  // Writes a fresh object, then swaps the pointer only if nobody saved since `baseVersion`.
  saveDocument: fileProcedure('editor')
    .input(
      z.object({
        baseVersion: z.number().int().nonnegative(),
        document: documentSnapshot,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { file, env, waitUntil } = ctx
      const key = objectKeys.document(file.id)
      const size = await writeJson(env.STORAGE, key, input.document)

      if (size > MAX_DOCUMENT_BYTES) {
        waitUntil(env.STORAGE.delete(key))
        throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE' })
      }

      const saved = await ctx.db
        .update(files)
        .set({
          documentKey: key,
          documentSize: size,
          version: sql`${files.version} + 1`,
          lastEditedById: ctx.user.id,
        })
        .where(and(eq(files.id, file.id), eq(files.version, input.baseVersion)))
        .returning({ version: files.version, updatedAt: files.updatedAt })
        .get()

      if (!saved) {
        waitUntil(env.STORAGE.delete(key))
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This file was changed somewhere else.',
        })
      }

      if (file.documentKey) waitUntil(env.STORAGE.delete(file.documentKey))
      return saved
    }),
})
