import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { and, eq } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import type { AppEnv } from '../env'
import { fileAccess, session } from '../middleware'
import { getCanvasAgent, getChatAccess } from '../services/chats'

const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header('origin')
  if (origin && origin !== c.env.WEB_URL) throw new HTTPException(403)
  await next()
})

export const agentRoutes = new Hono<AppEnv>()
  .get(
    '/files/:fileId/agent/:conversationId/*',
    sameOrigin,
    session,
    fileAccess('editor'),
    async (c) => {
      const endpoint = c.req.path.split('/').pop()
      if (endpoint !== 'chat' && endpoint !== 'get-messages')
        throw new HTTPException(404)
      const { file } = c.var.access
      const userId = c.var.session!.user.id
      const chat = await c.var.db
        .select()
        .from(schema.chats)
        .where(
          and(
            eq(schema.chats.id, c.req.param('conversationId')),
            eq(schema.chats.fileId, file.id),
            eq(schema.chats.userId, userId),
          ),
        )
        .get()
      if (!chat || file.trashedAt) throw new HTTPException(404)
      const agent = await getCanvasAgent(c.env, chat)
      return agent.fetch(c.req.raw)
    },
  )
  .get(
    '/chats/:chatId/changes/:changeId/preview',
    sameOrigin,
    session,
    async (c) => {
      const user = c.var.session?.user
      if (!user) throw new HTTPException(401)
      try {
        const { chat } = await getChatAccess(
          c.var.db,
          c.req.param('chatId'),
          user.id,
        )
        const change = await c.var.db
          .select({ previewKey: schema.chatChanges.previewKey })
          .from(schema.chatChanges)
          .where(
            and(
              eq(schema.chatChanges.id, c.req.param('changeId')),
              eq(schema.chatChanges.chatId, chat.id),
            ),
          )
          .get()
        const object = change?.previewKey
          ? await c.env.STORAGE.get(change.previewKey)
          : null
        if (!object) throw new HTTPException(404)
        const headers = new Headers({
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
        })
        object.writeHttpMetadata(headers)
        return new Response(object.body, { headers })
      } catch (error) {
        if (error instanceof HTTPException) throw error
        throw new HTTPException(404)
      }
    },
  )
