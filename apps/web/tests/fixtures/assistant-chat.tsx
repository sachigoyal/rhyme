import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import { createApiClient, TRPCProvider } from '@rhyme/trpc-client'
import { TooltipProvider } from '@rhyme/ui/components/tooltip'
import { ToastProvider } from '@rhyme/ui/components/toast'
import { Tldraw } from 'tldraw'
import type { Editor } from 'tldraw'
import { AIConnectionsSettings } from '../../src/features/settings/ai-connections'
import { AgentPanel } from '../../src/features/agent/agent-panel'
import { useAssistantStore } from '../../src/features/agent/assistant-preferences'
import '@rhyme/ui/globals.css'
import 'tldraw/tldraw.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
queryClient.setQueryData(['session'], { user: { id: 'fixture-user' } })
const client = createApiClient('http://localhost:8787/trpc')
Object.assign(window, {
  assistantFixture: { queryClient, store: useAssistantStore },
})

function Fixture() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [open, setOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={client} queryClient={queryClient}>
        <TooltipProvider>
          <ToastProvider>
            <div
              aria-hidden
              inert
              style={{
                position: 'fixed',
                left: -10000,
                width: 800,
                height: 600,
              }}
            >
              <Tldraw onMount={setEditor} />
            </div>
            <button onClick={() => setOpen((value) => !value)}>
              Toggle panel
            </button>
            <button onClick={() => setSettingsOpen((value) => !value)}>
              Toggle settings
            </button>
            {settingsOpen && <AIConnectionsSettings />}
            {editor && open && (
              <div style={{ width: 'min(380px, 100vw)', height: 700 }}>
                <AgentPanel
                  fileId="fixture-file"
                  editor={editor}
                  onClose={() => setOpen(false)}
                />
              </div>
            )}
          </ToastProvider>
        </TooltipProvider>
      </TRPCProvider>
    </QueryClientProvider>
  )
}
const root = createRootRoute()
const route = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: Fixture,
})
const settings = createRoute({
  getParentRoute: () => root,
  path: '/settings',
  component: Fixture,
})
const router = createRouter({
  routeTree: root.addChildren([route, settings]),
  history: createMemoryHistory({ initialEntries: ['/'] }),
})
createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />,
)
