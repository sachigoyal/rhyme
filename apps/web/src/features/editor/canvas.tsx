import { useEffect, useMemo, useState } from 'react'
import { Tldraw } from 'tldraw'
import type { Editor, TLStoreSnapshot } from 'tldraw'
import { useSettings } from '@rhyme/hooks/queries'
import { useThumbnailUploaded } from '@rhyme/hooks/mutations'
import { useTheme } from '@rhyme/ui/components/theme'
import { env } from '@/lib/env'
import { createAssetStore, createThumbnailer } from './assets'
import type { DocumentSync } from './document-sync'
import type { InitialDocument } from './use-initial-document'

interface CanvasProps {
  fileId: string
  initial: InitialDocument
  sync: DocumentSync | null
  onReady?: (editor: Editor | null) => void
  headless?: boolean
}

export function Canvas({
  fileId,
  initial,
  sync,
  onReady,
  headless,
}: CanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const { resolvedTheme } = useTheme()
  const { data: preferences } = useSettings()
  const assets = useMemo(() => createAssetStore(fileId), [fileId])
  const thumbnailUploaded = useThumbnailUploaded()
  const thumbnailer = useMemo(
    () => createThumbnailer(fileId, () => thumbnailUploaded(fileId)),
    [fileId, thumbnailUploaded],
  )

  useEffect(() => {
    editor?.user.updateUserPreferences({
      colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light',
    })
  }, [editor, resolvedTheme])

  useEffect(() => {
    if (!editor || !preferences || headless) return
    editor.updateInstanceState({ isGridMode: preferences.showGrid })
    editor.user.updateUserPreferences({ isSnapMode: preferences.snapToShapes })
  }, [editor, preferences?.showGrid, preferences?.snapToShapes, headless])

  const onMount = (mounted: Editor) => {
    setEditor(mounted)
    onReady?.(mounted)
    mounted.updateInstanceState({ isReadonly: !sync })
    if (headless) mounted.zoomToFit()
    if (!sync) return () => onReady?.(null)

    const detach = sync.attach(mounted)
    const stopSaved = sync.subscribe(
      () => sync.getStatus() === 'saved' && thumbnailer.schedule(mounted),
    )
    return () => {
      onReady?.(null)
      stopSaved()
      thumbnailer.flush(mounted)
      detach()
    }
  }

  return (
    <Tldraw
      licenseKey={env.tldrawLicenseKey}
      snapshot={(initial.document ?? undefined) as TLStoreSnapshot | undefined}
      assets={assets}
      onMount={onMount}
      hideUi={headless}
      autoFocus={!headless}
    />
  )
}
