import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { getAgentByName } from 'agents'
import { schema } from '@rhyme/db'
import type { Database, FileRole } from '@rhyme/db'
import type { Env } from '../env'
import { getFileAccess, hasRole } from './access'

export async function getChatAccess(
  db: Database,
  chatId: string,
  userId: string,
  required: FileRole = 'viewer',
) {
  const chat = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .get()
  if (!chat)
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Conversation not found',
    })
  const access = await getFileAccess(db, chat.fileId, userId)
  if (!access || access.file.trashedAt)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Canvas not found' })
  if (!hasRole(access.role, required))
    throw new TRPCError({ code: 'FORBIDDEN' })
  return { chat, ...access }
}

function getNamedAgent(env: Env, name: string) {
  const namespace = env.CanvasAgent as unknown as Parameters<
    typeof getAgentByName
  >[0]
  return getAgentByName(namespace, name)
}

export function getCanvasAgent(
  env: Env,
  chat: { id: string; fileId: string; userId: string },
) {
  return getNamedAgent(env, `${chat.fileId}:${chat.userId}:${chat.id}`)
}

export function getLegacyCanvasAgent(env: Env, fileId: string, userId: string) {
  return getNamedAgent(env, `${fileId}:${userId}`)
}

export async function deleteFileChatStorage(
  env: Env,
  fileId: string,
  chats: Array<{ id: string; userId: string }>,
  legacyUserIds: string[],
) {
  const names = [
    ...chats.map((chat) => `${fileId}:${chat.userId}:${chat.id}`),
    ...new Set(legacyUserIds.map((userId) => `${fileId}:${userId}`)),
  ]
  for (let start = 0; start < names.length; start += 8) {
    await Promise.all(
      names.slice(start, start + 8).map(async (name) => {
        const agent = await getNamedAgent(env, name)
        const response = await agent.fetch(
          new Request('https://agent.internal/remove', { method: 'DELETE' }),
        )
        if (!response.ok)
          throw new Error('Could not remove conversation storage')
      }),
    )
  }
}
