import { queryOptions } from '@tanstack/react-query'
import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'
import { env } from './env'

export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  basePath: '/auth',
  fetchOptions: { credentials: 'include' },
  plugins: [emailOTPClient()],
})

export type SessionUser = typeof authClient.$Infer.Session.user

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async () => (await authClient.getSession()).data,
  staleTime: 5 * 60 * 1000,
})

export const displayName = (user: Pick<SessionUser, 'name' | 'email'>) =>
  user.name || user.email.split('@')[0] || user.email
