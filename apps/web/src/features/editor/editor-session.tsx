import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import type { Editor } from 'tldraw'
import { useSaveFileDocument } from '@rhyme/hooks/mutations'
import { useTRPCClient } from '@rhyme/trpc-client'
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
import { AgentPanel } from '@/features/agent/agent-panel'
import type { SessionUser } from '@/lib/auth'
import { Canvas } from './canvas'
import { DocumentSync } from './document-sync'
import { FileTitle } from './file-title'
import { SaveStatus } from './save-status'
import { ShareDialog } from './share-dialog'
import type { InitialDocument } from './use-initial-document'

interface EditorSessionProps {
  file: FileSummary
  initial: InitialDocument
  user: SessionUser
  onReload: () => void
}

export function EditorSession({
  file,
  initial,
  user,
  onReload,
}: EditorSessionProps) {
  const canEdit = file.role !== 'viewer'
  const [resolving, setResolving] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentStarted, setAgentStarted] = useState(false)
  const [agentBusy, setAgentBusy] = useState(false)
  const agentPanel = usePanelRef()
  const trpcClient = useTRPCClient()
  const { mutateAsync: save } = useSaveFileDocument()
  const saveRef = useRef(save)
  saveRef.current = save

  const [sync] = useState(() =>
    canEdit
      ? new DocumentSync({
          fileId: file.id,
          version: initial.version,
          dirty: initial.dirty,
          save: (input) => saveRef.current(input),
          fetchVersion: async () =>
            (await trpcClient.files.get.query({ id: file.id })).version,
        })
      : null,
  )

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
      <header className="bg-background flex h-12 shrink-0 items-center gap-1 border-b px-2">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          aria-label="Back to files"
        >
          <Link
            to="/files"
            search={{ view: file.role === 'owner' ? 'mine' : 'shared' }}
          >
            <ArrowLeft />
          </Link>
        </Button>
        <FileTitle id={file.id} name={file.name} editable={canEdit} />
        {!canEdit && <Badge variant="secondary">View only</Badge>}

        <div className="ml-auto flex items-center gap-2">
          {sync && (
            <SaveStatus sync={sync} onResolve={() => setResolving(true)} />
          )}
          {canEdit && (
            <Button
              size="sm"
              variant={agentOpen ? 'secondary' : 'ghost'}
              aria-pressed={agentOpen}
              disabled={!editor}
              onClick={() => setAgentVisible(!agentOpen)}
            >
              {agentBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Assistant
            </Button>
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

      <main className="relative min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="canvas" minSize={320}>
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
                defaultSize={0}
                minSize={300}
                maxSize={640}
                onResize={(size) => setAgentOpen(size.inPixels > 0)}
              >
                {agentStarted && editor && (
                  <AgentPanel
                    fileId={file.id}
                    editor={editor}
                    onClose={() => setAgentVisible(false)}
                    onBusyChange={setAgentBusy}
                  />
                )}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {sync && (
        <AlertDialog open={resolving} onOpenChange={setResolving}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                This file changed somewhere else
              </AlertDialogTitle>
              <AlertDialogDescription>
                Someone saved a newer version while you were editing. Keep your
                version to overwrite it, or load the latest and discard your
                recent changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onReload}>
                Load latest
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void sync.keepLocal()}>
                Keep mine
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
