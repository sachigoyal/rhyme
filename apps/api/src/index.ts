import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from './env'
import { services, session } from './middleware'
import { appRouter } from './router'
import { agentRoutes } from './routes/agent'
import { storageRoutes } from './routes/storage'
import { createContext } from './trpc/context'

export { CanvasAgent } from './agents/canvas-agent'

const app = new Hono<AppEnv>()

const corsHeaders = cors({
  origin: (origin, c: Context<AppEnv>) =>
    origin === c.env.WEB_URL ? origin : null,
  credentials: true,
  allowHeaders: ['content-type', 'x-file-name', 'trpc-accept'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
})

// WebSocket upgrade responses have immutable headers; CORS doesn't apply to them anyway.
app.use('*', (c, next) =>
  c.req.header('upgrade')?.toLowerCase() === 'websocket'
    ? next()
    : corsHeaders(c, next),
)

app.use('*', services)

app.get('/', (c) => c.json({ name: 'rhyme-api', ok: true }))

app.on(['GET', 'POST'], '/auth/*', (c) => c.var.auth.handler(c.req.raw))

app.use(
  '/trpc/*',
  session,
  trpcServer({
    endpoint: '/trpc',
    router: appRouter,
    createContext: (_, c) => createContext(c as Context<AppEnv>),
  }),
)

app.route('/', storageRoutes)
app.route('/', agentRoutes)

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse()
  console.error(error)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
