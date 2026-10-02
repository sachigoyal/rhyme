import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { schema } from '@rhyme/db'
import { eq } from 'drizzle-orm'
import type { Database } from '@rhyme/db'
import type { Env } from '../env'
import { sendVerificationCode } from './email'
import { OTP_EXPIRY_SECONDS } from '../emails/verification-code'

interface CreateAuthOptions {
  env: Env
  db: Database
  waitUntil: (promise: Promise<unknown>) => void
}

export function createAuth({ env, db, waitUntil }: CreateAuthOptions) {
  const providerProfile = async (
    email: string | null | undefined,
    name: string,
    image: string | undefined,
  ) => {
    const user = email
      ? await db
          .select({ name: schema.users.name, image: schema.users.image })
          .from(schema.users)
          .where(eq(schema.users.email, email.toLowerCase()))
          .get()
      : undefined
    return { name: user?.name || name, image: user?.image || image }
  }

  return betterAuth({
    baseURL: env.API_URL,
    basePath: '/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_URL],
    socialProviders: {
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              mapProfileToUser: (profile) =>
                providerProfile(profile.email, profile.name, profile.picture),
            }
          : undefined,
      github:
        env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
          ? {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
              mapProfileToUser: (profile) =>
                providerProfile(
                  profile.email,
                  profile.name || profile.login,
                  profile.avatar_url,
                ),
            }
          : undefined,
    },
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: false,
        allowDifferentEmails: false,
        trustedProviders: [],
        updateUserInfoOnLink: true,
      },
    },
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
      usePlural: true,
    }),
    plugins: [
      emailOTP({
        expiresIn: OTP_EXPIRY_SECONDS,
        otpLength: 6,
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp, type }) => {
          waitUntil(sendVerificationCode(env, { to: email, code: otp, type }))
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type AuthSession = NonNullable<
  Awaited<ReturnType<Auth['api']['getSession']>>
>
