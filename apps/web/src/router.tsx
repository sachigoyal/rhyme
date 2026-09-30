import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { createApiClient, errorCode } from '@rhyme/trpc-client'
import { Providers } from './components/providers'
import { env } from './lib/env'
import { sessionQuery } from './lib/auth'
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
    queryClient.setQueryData(sessionQuery.queryKey, null)
    void router.navigate({ to: '/sign-in' })
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
    context: { queryClient },
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
