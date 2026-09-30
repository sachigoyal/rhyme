import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { TRPCProvider } from '@rhyme/trpc-client'
import type { ApiClient } from '@rhyme/trpc-client'
import { Toaster } from '@rhyme/ui/components/sonner'
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
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
