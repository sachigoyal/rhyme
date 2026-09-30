import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createDb } from '@rhyme/db'
import type { FileRole } from '@rhyme/db'
import type { AppEnv } from './env'
import { createAuth } from './lib/auth'
import { getFileAccess, hasRole } from './services/access'
import type { FileAccess } from './services/access'

export const services = createMiddleware<AppEnv>(async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  c.set(
    'auth',
    createAuth({
      env: c.env,
      db,
      waitUntil: (promise) => c.executionCtx.waitUntil(promise),
    }),
  )
  await next()
})

export const session = createMiddleware<AppEnv>(async (c, next) => {
  c.set(
    'session',
    await c.var.auth.api.getSession({ headers: c.req.raw.headers }),
  )
  await next()
})

export const fileAccess = (required: FileRole) =>
  createMiddleware<AppEnv & { Variables: { access: FileAccess } }>(
    async (c, next) => {
      const user = c.var.session?.user
      if (!user) throw new HTTPException(401)

      const access = await getFileAccess(
        c.var.db,
        c.req.param('fileId') ?? '',
        user.id,
      )
      if (!access) throw new HTTPException(404)
      if (!hasRole(access.role, required)) throw new HTTPException(403)

      c.set('access', access)
      await next()
    },
  )
