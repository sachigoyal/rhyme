import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInForm } from '@/features/auth/sign-in-form'
import { Logo } from '@/components/logo'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  validateSearch: z.object({ redirect: z.string().startsWith('/').optional() }),
  beforeLoad: async ({ context, search }) => {
    if (await context.queryClient.ensureQueryData(sessionQuery)) {
      throw redirect({ href: search.redirect ?? '/files' })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  const { redirect: next } = Route.useSearch()
  return (
    <main className="bg-muted/40 grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <Logo className="justify-center" />
        <SignInForm redirectTo={next ?? '/files'} />
      </div>
    </main>
  )
}
