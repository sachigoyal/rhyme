import { createFileRoute, redirect } from '@tanstack/react-router'
import { Check, LayoutTemplate, Sparkles } from 'lucide-react'
import { SignInForm } from '@/features/auth/sign-in-form'
import { signInSearch } from '@/features/auth/redirect'
import { Logo } from '@/components/logo'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  validateSearch: signInSearch,
  beforeLoad: async ({ context, search }) => {
    if (await context.queryClient.fetchQuery(sessionQuery)) {
      throw redirect({ to: '/auth/complete', search })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  const { redirect: next, error } = Route.useSearch()
  return (
    <main className="bg-background grid min-h-svh lg:grid-cols-2">
      <section className="flex flex-col px-6 py-6 sm:px-12">
        <header className="flex items-center justify-between">
          <Logo />
        </header>
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <SignInForm redirectTo={next ?? '/'} authError={error} />
          </div>
        </div>
      </section>
      <aside className="bg-muted/20 hidden flex-col justify-center border-l p-12 lg:flex xl:p-20">
        <div className="max-w-lg">
          <h2 className="text-5xl font-medium leading-tight tracking-tight xl:text-6xl">
            Draw and collaborate
          </h2>
          <p className="text-muted-foreground mt-6 max-w-sm text-sm leading-relaxed">
            Create diagrams on an infinite canvas, share access, and use the
            assistant to make edits.
          </p>
          <div className="mt-12 space-y-4">
            {[
              { icon: Check, label: 'Automatic saving' },
              {
                icon: Sparkles,
                label: 'Rhyme',
              },
              { icon: LayoutTemplate, label: 'Viewer and editor permissions' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className="bg-background grid size-8 place-items-center rounded-lg border">
                  <Icon className="size-4" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  )
}
