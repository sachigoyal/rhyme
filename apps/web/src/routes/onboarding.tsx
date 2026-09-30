import { createFileRoute, redirect } from '@tanstack/react-router'
import { Logo } from '@/components/logo'
import { OnboardingForm } from '@/features/auth/onboarding-form'
import { authSearch } from '@/features/auth/redirect'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/onboarding')({
  ssr: false,
  validateSearch: authSearch,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session)
      throw redirect({ to: '/sign-in', search: { redirect: '/onboarding' } })
    return { user: session.user }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { user } = Route.useRouteContext()
  const { redirect: next } = Route.useSearch()
  return (
    <main className="bg-background flex min-h-svh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6 sm:px-10">
        <Logo />
        <span className="text-muted-foreground text-xs">
          A fresh space for your ideas
        </span>
      </header>
      <div className="grid flex-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="bg-muted/20 hidden flex-col justify-between border-r p-12 lg:flex xl:p-20">
          <div className="max-w-sm">
            <p className="text-muted-foreground mb-6 text-xs uppercase tracking-widest">
              Welcome to Rhyme
            </p>
            <h1 className="text-5xl font-medium leading-tight tracking-tight">
              Good ideas
              <br />
              need a little
              <br />
              room.
            </h1>
            <p className="text-muted-foreground mt-6 text-sm leading-relaxed">
              Your canvas, your assistant, and everything you create — together
              in one quiet workspace.
            </p>
          </div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            A few quick questions.
            <br />
            Skip anything you would rather keep to yourself.
          </div>
        </aside>
        <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:py-16">
          <OnboardingForm user={user} redirectTo={next ?? '/'} />
        </section>
      </div>
    </main>
  )
}
