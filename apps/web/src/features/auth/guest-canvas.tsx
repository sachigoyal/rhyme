import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, LayoutGrid, Share2, X } from 'lucide-react'
import { getSnapshot, Tldraw } from 'tldraw'
import type { Editor, TLStoreSnapshot } from 'tldraw'
import { toast } from 'sonner'
import { Button } from '@rhyme/ui/components/button'
import { useTheme } from '@rhyme/ui/components/theme'
import { Logo } from '@/components/logo'
import { GuestIntroduction } from '@/components/guest-introduction'
import { AgentLauncher } from '@/features/agent/agent-launcher'
import { env } from '@/lib/env'
import { guestDraft } from './guest-draft'

export function GuestCanvas() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [initialDraft] = useState(() => guestDraft.get()?.document)
  const [showHint, setShowHint] = useState(!initialDraft)
  const [storageError, setStorageError] = useState(false)
  const [saving, setSaving] = useState(false)
  const failed = useRef(false)
  const flushRef = useRef<(() => boolean) | null>(null)
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    editor?.user.updateUserPreferences({ colorScheme: resolvedTheme })
  }, [editor, resolvedTheme])

  useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let dirty = !initialDraft
    const flush = () => {
      clearTimeout(timer)
      if (!dirty) return !failed.current
      try {
        const { document } = getSnapshot(editor.store)
        guestDraft.set({
          store: document.store,
          schema: { ...document.schema },
        })
        dirty = false
        failed.current = false
        setStorageError(false)
        setSaving(false)
        return true
      } catch {
        failed.current = true
        setStorageError(true)
        setSaving(false)
        return false
      }
    }
    flushRef.current = flush
    flush()
    const dispose = editor.store.listen(
      () => {
        dirty = true
        setSaving(true)
        clearTimeout(timer)
        timer = setTimeout(flush, 300)
      },
      { scope: 'document' },
    )
    const onHide = () => {
      if (document.hidden) flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      dispose()
      flush()
      flushRef.current = null
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [editor, initialDraft])

  const signUp = async () => {
    if (!editor || !flushRef.current) return
    if (!flushRef.current()) {
      toast.error(
        'Unable to save this canvas on this device. Remove large media files or free browser storage, then try again.',
      )
      return
    }
    await navigate({ to: '/sign-in', search: { redirect: '/files' } })
  }

  return (
    <main className="bg-background flex h-svh flex-col">
      <header className="bg-card flex h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Logo compactOnMobile />
        <span className="mx-2 hidden h-5 border-l sm:block" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open workspace"
          onClick={() => void signUp()}
          disabled={!editor}
        >
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => void signUp()}
          disabled={!editor}
        >
          Untitled
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span
            role="status"
            className="text-muted-foreground hidden text-xs md:block"
          >
            {storageError
              ? 'Changes aren’t saved on this device'
              : saving
                ? 'Saving on this device…'
                : 'Saved on this device'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signUp()}
            disabled={!editor}
          >
            <Share2 className="size-3.5" /> Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signUp()}
            disabled={!editor}
          >
            Sign in
          </Button>
          <Button size="sm" onClick={() => void signUp()} disabled={!editor}>
            Save canvas <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <Tldraw
          licenseKey={env.tldrawLicenseKey}
          snapshot={initialDraft as TLStoreSnapshot | undefined}
          onMount={setEditor}
        />
        {editor && (
          <div className="absolute bottom-20 right-4 z-350 sm:right-5">
            <AgentLauncher open={false} onClick={() => void signUp()} />
          </div>
        )}
        {storageError && (
          <p
            role="alert"
            className="bg-background text-destructive absolute top-4 left-1/2 z-300 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border px-4 py-3 text-xs"
          >
            Browser storage is full or unavailable. Keep this page open to
            preserve your changes.
          </p>
        )}
        {showHint && !storageError && (
          <div className="bg-background pointer-events-none absolute top-4 left-1/2 z-300 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 rounded-lg border px-4 py-3">
            <GuestIntroduction />
            <Button
              className="pointer-events-auto shrink-0"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss canvas introduction"
              onClick={() => setShowHint(false)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
