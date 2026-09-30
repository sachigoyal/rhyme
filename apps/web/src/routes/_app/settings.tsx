import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/settings/settings-page'

export const Route = createFileRoute('/_app/settings')({
  component: () => {
    const { user } = Route.useRouteContext()
    return <SettingsPage user={user} />
  },
})
