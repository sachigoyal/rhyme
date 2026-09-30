import type { Context as HonoContext } from 'hono'
import type { AppEnv } from '../env'

export function createContext(c: HonoContext<AppEnv>) {
  return {
    db: c.var.db,
    env: c.env,
    user: c.var.session?.user ?? null,
    waitUntil: (promise: Promise<unknown>) => c.executionCtx.waitUntil(promise),
  }
}

export type Context = ReturnType<typeof createContext>
