import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { schema } from '@rhyme/db'
import type { Database } from '@rhyme/db'
import type { Env } from '../env'
import { sendSignInCode } from './email'

interface CreateAuthOptions {
  env: Env
  db: Database
  waitUntil: (promise: Promise<unknown>) => void
}

export function createAuth({ env, db, waitUntil }: CreateAuthOptions) {
  return betterAuth({
    baseURL: env.API_URL,
    basePath: '/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_URL],
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
      usePlural: true,
    }),
    plugins: [
      emailOTP({
        expiresIn: 10 * 60,
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp }) => {
          waitUntil(sendSignInCode(env, { to: email, code: otp }))
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type AuthSession = NonNullable<
  Awaited<ReturnType<Auth['api']['getSession']>>
>
