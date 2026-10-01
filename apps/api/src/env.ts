import type {
  Ai,
  D1Database,
  DurableObjectNamespace,
  R2Bucket,
  SendEmail,
} from '@cloudflare/workers-types'
import type { Database } from '@rhyme/db'
import type { Auth, AuthSession } from './lib/auth'

export interface Env {
  AI: Ai
  DB: D1Database
  STORAGE: R2Bucket
  EMAIL: SendEmail
  CanvasAgent: DurableObjectNamespace
  API_URL: string
  WEB_URL: string
  EMAIL_FROM: string
  BYOK_ENCRYPTION_KEY?: string
  BETTER_AUTH_SECRET: string
  AI_MODEL: string
}

export interface AppEnv {
  Bindings: Env
  Variables: {
    db: Database
    auth: Auth
    session: AuthSession | null
  }
}
