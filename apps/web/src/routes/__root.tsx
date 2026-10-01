import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { ApiOptions } from '@rhyme/trpc-client'
import { PageNotFound } from '@/components/recovery-state'
import { RoutePending } from '@/components/route-pending'
import type { QueryClient } from '@tanstack/react-query'
import { themeScript } from '@rhyme/ui/components/theme'
import appCss from '../styles.css?url'
import { createSeoHead, getSeoPage } from '@/lib/seo'
import { env } from '@/lib/env'

export interface RouterContext {
  queryClient: QueryClient
  trpc: ApiOptions
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ location }) => ({ seoLocation: location.href }),
  head: ({ match }) => {
    const seo = createSeoHead(
      getSeoPage(match.context.seoLocation),
      env.siteUrl,
      env.allowIndexing,
    )
    return {
      meta: [
        { charSet: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        ...seo.meta,
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon.svg?v=5', type: 'image/svg+xml' },
        ...seo.links,
      ],
    }
  },
  pendingComponent: RoutePending,
  notFoundComponent: () => <PageNotFound />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body className="relative min-h-svh antialiased">
        <div className="isolate">{children}</div>
        <Scripts />
      </body>
    </html>
  )
}
