import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    return { user: session.user }
  },
  component: Outlet,
})
