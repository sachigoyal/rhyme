import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import type { UIMessage } from 'ai'
import { schema } from '@rhyme/db'
import type { Database } from '@rhyme/db'
import type { Env } from '../env'
import { getCanvasAgent, getLegacyCanvasAgent } from './chats'

async function legacyConversationId(fileId: string, userId: string) {
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${fileId}:${userId}:legacy`),
    ),
  )
  hash[6] = (hash[6]! & 15) | 128
  hash[8] = (hash[8]! & 63) | 128
  const hex = Array.from(hash.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function importLegacyChat(
  db: Database,
  env: Env,
  fileId: string,
  userId: string,
) {
  const legacy = await getLegacyCanvasAgent(env, fileId, userId)
  const response = await legacy.fetch(
    new Request('https://agent.internal/history'),
  )
  if (!response.ok) throw new Error('Could not read legacy conversation')
  const messages = (await response.json()) as UIMessage[]
  if (!Array.isArray(messages)) throw new Error('Invalid legacy conversation')
  let chatId: string | null = null
  if (messages.length) {
    chatId = await legacyConversationId(fileId, userId)
    await db
      .insert(schema.chats)
      .values({ id: chatId, fileId, userId })
      .onConflictDoNothing()
    const agent = await getCanvasAgent(env, { id: chatId, fileId, userId })
    const imported = await agent.fetch(
      new Request('https://agent.internal/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages }),
      }),
    )
    if (!imported.ok) throw new Error('Could not import legacy conversation')
  }
  await db
    .insert(schema.legacyChatImports)
    .values({ fileId, userId, chatId })
    .onConflictDoNothing()
}

export async function ensureLegacyChats(
  db: Database,
  env: Env,
  userId: string,
  fileId?: string,
) {
  const { files, fileCollaborators, legacyChatImports } = schema
  const candidates = await db
    .select({ id: files.id })
    .from(files)
    .leftJoin(
      fileCollaborators,
      and(
        eq(fileCollaborators.fileId, files.id),
        eq(fileCollaborators.userId, userId),
      ),
    )
    .where(
      and(
        isNull(files.trashedAt),
        or(eq(files.ownerId, userId), eq(fileCollaborators.userId, userId)),
        fileId ? eq(files.id, fileId) : undefined,
      ),
    )
    .limit(200)
  if (!candidates.length) return
  const marked = await db
    .select({ fileId: legacyChatImports.fileId })
    .from(legacyChatImports)
    .where(
      and(
        eq(legacyChatImports.userId, userId),
        inArray(
          legacyChatImports.fileId,
          candidates.map((file) => file.id),
        ),
      ),
    )
  const known = new Set(marked.map((marker) => marker.fileId))
  const pending = candidates.filter((file) => !known.has(file.id))
  for (let start = 0; start < pending.length; start += 8) {
    await Promise.all(
      pending
        .slice(start, start + 8)
        .map((file) => importLegacyChat(db, env, file.id, userId)),
    )
  }
}
