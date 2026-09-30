import {
  TRPCClientError,
  createTRPCClient,
  httpBatchLink,
  httpLink,
  splitLink,
} from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import superjson from 'superjson'
import type { AppRouter } from 'api/router'

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>()

export function createApiClient(url: string) {
  const options = {
    url,
    transformer: superjson,
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, credentials: 'include' }),
  }

  return createTRPCClient<AppRouter>({
    links: [
      // Large document saves skip batching so they never hold up queries.
      splitLink({
        condition: (op) => op.path === 'files.saveDocument',
        true: httpLink(options),
        false: httpBatchLink(options),
      }),
    ],
  })
}

export type ApiClient = ReturnType<typeof createApiClient>
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>

export type FileSummary = RouterOutputs['files']['list'][number]
export type FilesListInput = Exclude<RouterInputs['files']['list'], void>
export type FileView = NonNullable<FilesListInput['view']>
export type FileDocument = RouterOutputs['files']['document']
export type Folder = RouterOutputs['folders']['list'][number]
export type Collaborator = RouterOutputs['collaborators']['list'][number]
export type { AppRouter, DocumentSnapshot } from 'api/router'

export function isApiError(
  error: unknown,
): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError
}

export function errorCode(error: unknown) {
  return isApiError(error) ? error.data?.code : undefined
}
