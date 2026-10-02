import { createFileRoute, redirect } from '@tanstack/react-router'
import { Logo } from '@/components/logo'
import { OnboardingForm } from '@/features/auth/onboarding-form'
import { authSearch } from '@/features/auth/redirect'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/onboarding')({
  ssr: false,
  validateSearch: authSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery)
    if (!session) throw redirect({ to: '/sign-in', search })
    const profile = await context.queryClient.ensureQueryData(
      context.trpc.profile.get.queryOptions(),
    )
    if (profile) throw redirect({ to: '/auth/complete', search })
    return { user: session.user }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { user } = Route.useRouteContext()
  const { redirect: redirectTo } = Route.useSearch()
  return (
    <main className="bg-background flex min-h-svh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6 sm:px-10">
        <Logo />
        <span className="text-muted-foreground text-xs">Account setup</span>
      </header>
      <div className="grid flex-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="bg-muted/20 hidden flex-col justify-between border-r p-12 lg:flex xl:p-20">
          <div className="max-w-sm">
            <h1 className="text-5xl font-medium leading-tight tracking-tight">
              Set up your account
            </h1>
            <p className="text-muted-foreground mt-6 text-sm leading-relaxed">
              Add your name and profile details.
            </p>
          </div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            Name and analytics preference are required. All other fields are
            optional.
          </div>
        </aside>
        <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:py-16">
          <OnboardingForm user={user} redirectTo={redirectTo} />
        </section>
      </div>
    </main>
  )
}
