import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { getAgentByName } from 'agents'
import type { CanvasAgent } from '../agents/canvas-agent'
import type { AppEnv } from '../env'
import { fileAccess, session } from '../middleware'

const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header('origin')
  if (origin && origin !== c.env.WEB_URL) throw new HTTPException(403)
  await next()
})

// Forwards the chat WebSocket (and its /get-messages fetch) to the caller's private agent for this file.
export const agentRoutes = new Hono<AppEnv>().get(
  '/files/:fileId/agent/*',
  sameOrigin,
  session,
  fileAccess('editor'),
  async (c) => {
    const { file } = c.var.access
    const userId = c.var.session!.user.id
    // env.ts stays free of workers globals because the web app type-checks it via the router.
    const namespace = c.env
      .CanvasAgent as unknown as globalThis.DurableObjectNamespace<CanvasAgent>
    const agent = await getAgentByName(namespace, `${file.id}:${userId}`)
    return agent.fetch(c.req.raw)
  },
)
