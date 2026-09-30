import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, X } from 'lucide-react'
import { getSnapshot, Tldraw } from 'tldraw'
import type { Editor, TLStoreSnapshot } from 'tldraw'
import { toast } from 'sonner'
import { Button } from '@rhyme/ui/components/button'
import { useTheme } from '@rhyme/ui/components/theme'
import { Logo } from '@/components/logo'
import { env } from '@/lib/env'
import { guestDraft } from './guest-draft'

export function GuestCanvas() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [initialDraft] = useState(() => guestDraft.get()?.document)
  const [showHint, setShowHint] = useState(true)
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    editor?.user.updateUserPreferences({ colorScheme: resolvedTheme })
  }, [editor, resolvedTheme])

  const signUp = async () => {
    if (!editor) return
    try {
      const { document } = getSnapshot(editor.store)
      guestDraft.set({ store: document.store, schema: { ...document.schema } })
      await navigate({ to: '/sign-in', search: { redirect: '/' } })
    } catch {
      toast.error(
        'This drawing is too large to carry into sign-up. Remove large images and try again.',
      )
    }
  }

  return (
    <main className="bg-background flex h-svh flex-col">
      <header className="bg-background flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-muted-foreground hidden border-l pl-4 text-xs sm:block">
            Your space to think
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs md:block">
            Try it freely. Sign up to save.
          </span>
          <Button variant="ghost" size="sm" onClick={() => void signUp()}>
            Sign in
          </Button>
          <Button size="sm" onClick={() => void signUp()}>
            Save your canvas <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <Tldraw
          licenseKey={env.tldrawLicenseKey}
          snapshot={initialDraft as TLStoreSnapshot | undefined}
          onMount={setEditor}
        />
        {showHint && (
          <div className="bg-background pointer-events-none absolute top-4 left-1/2 z-300 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Start with a thought.</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Draw, write, or drop an image. This canvas is yours to explore.
              </p>
            </div>
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
