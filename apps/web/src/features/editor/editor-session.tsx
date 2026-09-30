import { lazy, Suspense, useState } from 'react'
import { useSettings } from '@rhyme/hooks/queries'
import { Link } from '@tanstack/react-router'
import { LayoutGrid } from 'lucide-react'
import type { Editor } from 'tldraw'
import type { FileSummary } from '@rhyme/trpc-client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@rhyme/ui/components/alert-dialog'
import { Badge } from '@rhyme/ui/components/badge'
import { Button } from '@rhyme/ui/components/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from '@rhyme/ui/components/resizable'
import { UserAvatar, UserMenu } from '@/components/user-menu'
import { AgentLauncher } from '@/features/agent/agent-launcher'
import type { AgentStatus } from '@/features/agent/agent-status'
import { Logo } from '@/components/logo'
import { AssistantSkeleton } from '@/components/loading-states'
import type { SessionUser } from '@/lib/auth'
import { Canvas } from './canvas'
import { useDocumentSync } from './use-document-sync'
import { FileTitle } from './file-title'
import { SaveStatus } from './save-status'
import { ShareDialog } from './share-dialog'
import type { InitialDocument } from './use-initial-document'

const AgentPanel = lazy(() =>
  import('@/features/agent/agent-panel').then((module) => ({
    default: module.AgentPanel,
  })),
)

interface EditorSessionProps {
  file: FileSummary
  initial: InitialDocument
  user: SessionUser
  onReload: () => void
  chatId?: string
}

export function EditorSession({
  file,
  initial,
  user,
  onReload,
  chatId,
}: EditorSessionProps) {
  const { data: preferences } = useSettings()
  const initiallyOpen = Boolean(
    chatId || (preferences?.openAssistant && file.role !== 'viewer'),
  )
  const canEdit = file.role !== 'viewer'
  const [resolving, setResolving] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [agentOpen, setAgentOpen] = useState(initiallyOpen)
  const [agentStarted, setAgentStarted] = useState(initiallyOpen)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const agentPanel = usePanelRef()
  const sync = useDocumentSync(file.id, initial, canEdit)

  // The chat stays mounted once opened so a reply in flight keeps drawing while the panel is closed.
  const setAgentVisible = (visible: boolean) => {
    const panel = agentPanel.current
    if (!panel) return
    if (visible) {
      setAgentStarted(true)
      panel.expand()
      panel.resize(380)
    } else {
      panel.collapse()
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link
          to="/files"
          className="mr-1 hidden shrink-0 sm:block"
          aria-label="Open workspace"
        >
          <Logo />
        </Link>
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          aria-label="Open workspace"
        >
          <Link
            to="/files"
            search={{ view: file.role === 'owner' ? 'mine' : 'shared' }}
          >
            <LayoutGrid className="size-4" />
          </Link>
        </Button>
        <FileTitle id={file.id} name={file.name} editable={canEdit} />
        {!canEdit && <Badge variant="secondary">View only</Badge>}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {sync && (
            <SaveStatus sync={sync} onResolve={() => setResolving(true)} />
          )}
          {file.role === 'owner' && (
            <ShareDialog fileId={file.id} fileName={file.name} />
          )}
          <UserMenu user={user}>
            <button
              className="rounded-full outline-none focus-visible:ring-2"
              aria-label="Account"
            >
              <UserAvatar user={user} className="size-7" />
            </button>
          </UserMenu>
        </div>
      </header>

      <main className="relative isolate min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="canvas" minSize={0}>
            <div className="relative h-full">
              <Canvas
                fileId={file.id}
                initial={initial}
                sync={sync}
                onReady={setEditor}
              />
            </div>
          </ResizablePanel>
          {canEdit && (
            <>
              <ResizableHandle className={agentOpen ? '' : 'hidden'} />
              <ResizablePanel
                id="assistant"
                panelRef={agentPanel}
                collapsible
                collapsedSize={0}
                defaultSize={initiallyOpen ? 380 : 0}
                minSize={300}
                maxSize={520}
                onResize={(size) => setAgentOpen(size.inPixels > 0)}
              >
                {agentStarted && editor && (
                  <div
                    className={agentOpen ? 'h-full' : 'hidden'}
                    inert={!agentOpen}
                  >
                    <Suspense fallback={<AssistantSkeleton />}>
                      <AgentPanel
                        fileId={file.id}
                        editor={editor}
                        onClose={() => setAgentVisible(false)}
                        onStateChange={setAgentStatus}
                        initialChatId={chatId}
                      />
                    </Suspense>
                  </div>
                )}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        {canEdit && editor && !agentOpen && (
          <div className="absolute right-4 bottom-4 z-350 flex">
            <AgentLauncher
              status={agentStatus}
              open={agentOpen}
              onClick={() => setAgentVisible(!agentOpen)}
            />
          </div>
        )}
      </main>

      {sync && (
        <AlertDialog open={resolving} onOpenChange={setResolving}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Canvas version conflict</AlertDialogTitle>
              <AlertDialogDescription>
                A newer version is available. Load it to discard your local
                changes, or overwrite it with your changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onReload}>
                Load latest version
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void sync.keepLocal()}>
                Overwrite latest version
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
