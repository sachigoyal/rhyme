import { useRouteContext } from '@tanstack/react-router'
import { PageNotFound } from '@/components/recovery-state'
import { WorkspaceShell } from './workspace-shell'

export default function WorkspaceNotFound() {
  const { user } = useRouteContext({ from: '/_app' })
  return (
    <WorkspaceShell user={user} section="files" title="Page not found">
      <PageNotFound embedded />
    </WorkspaceShell>
  )
}
