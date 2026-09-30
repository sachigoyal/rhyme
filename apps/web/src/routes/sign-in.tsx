import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowLeft, Check, LayoutTemplate, Sparkles } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { SignInForm } from '@/features/auth/sign-in-form'
import { authSearch } from '@/features/auth/redirect'
import { Logo } from '@/components/logo'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  validateSearch: authSearch,
  beforeLoad: async ({ context, search }) => {
    if (await context.queryClient.ensureQueryData(sessionQuery)) {
      throw redirect({ href: search.redirect ?? '/' })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  const { redirect: next } = Route.useSearch()
  return (
    <main className="bg-background grid min-h-svh lg:grid-cols-2">
      <section className="flex flex-col px-6 py-6 sm:px-12">
        <header className="flex items-center justify-between">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-3.5" /> Back to canvas
            </Link>
          </Button>
        </header>
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <SignInForm redirectTo={next ?? '/'} />
          </div>
        </div>
        <p className="text-muted-foreground text-center text-xs">
          A thoughtful space for everything you are thinking about.
        </p>
      </section>
      <aside className="bg-muted/20 hidden flex-col justify-between border-l p-12 lg:flex xl:p-20">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">
          From thought to something
        </p>
        <div className="max-w-lg">
          <h2 className="text-5xl font-medium leading-tight tracking-tight xl:text-6xl">
            A little more
            <br />
            space to think.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-sm text-sm leading-relaxed">
            Keep your ideas close. A canvas to explore them, and an assistant to
            help you move them forward.
          </p>
          <div className="mt-12 space-y-4">
            {[
              { icon: Check, label: 'Your drawings, saved as you go' },
              {
                icon: Sparkles,
                label: 'An assistant that creates alongside you',
              },
              { icon: LayoutTemplate, label: 'One calm home for every idea' },
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
        <p className="text-muted-foreground text-xs">
          Less noise. More possibility.
        </p>
      </aside>
    </main>
  )
}
