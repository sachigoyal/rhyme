import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import {
  createApiClient,
  createApiOptions,
  errorCode,
} from '@rhyme/trpc-client'
import { RouteError } from './components/route-error'
import { RoutePending } from './components/route-pending'
import { Providers } from './components/providers'
import { env } from './lib/env'
import { sessionQuery } from './lib/auth'
import { safeAuthRedirect } from './features/auth/redirect'
import { routeTree } from './routeTree.gen'

const FINAL_ERRORS = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'BAD_REQUEST',
])

export function getRouter() {
  const onError = (error: unknown) => {
    if (errorCode(error) !== 'UNAUTHORIZED') return
    queryClient.clear()
    queryClient.setQueryData(sessionQuery.queryKey, null)
    void router.navigate({
      to: '/sign-in',
      search: {
        redirect:
          safeAuthRedirect(router.state.location.href) ??
          safeAuthRedirect(
            new URL(router.state.location.href, env.siteUrl).searchParams.get(
              'redirect',
            ),
          ),
      },
    })
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 2 && !FINAL_ERRORS.has(errorCode(error) ?? ''),
      },
    },
  })

  const trpcClient = createApiClient(new URL('/trpc', env.apiUrl).href)

  const router = createRouter({
    routeTree,
    context: { queryClient, trpc: createApiOptions(trpcClient, queryClient) },
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultPendingMs: 100,
    defaultPendingMinMs: 0,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <Providers queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </Providers>
    ),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
