import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { TRPCProvider } from '@rhyme/trpc-client'
import type { ApiClient } from '@rhyme/trpc-client'
import { ToastProvider } from '@rhyme/ui/components/toast'
import { ThemeProvider } from '@rhyme/ui/components/theme'
import { TooltipProvider } from '@rhyme/ui/components/tooltip'

interface ProvidersProps {
  queryClient: QueryClient
  trpcClient: ApiClient
  children: React.ReactNode
}

export function Providers({
  queryClient,
  trpcClient,
  children,
}: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <TooltipProvider delay={300}>{children}</TooltipProvider>
          </ToastProvider>
        </ThemeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
