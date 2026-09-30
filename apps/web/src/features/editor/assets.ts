import type { Editor, TLAssetStore } from 'tldraw'
import { uploadAsset, uploadThumbnail } from '@/lib/storage'

export function createAssetStore(fileId: string): TLAssetStore {
  return {
    upload: async (_asset, file) => ({
      src: (await uploadAsset(fileId, file)).url,
    }),
    resolve: (asset) => asset.props.src,
  }
}

const THUMBNAIL_SIZE = 800
const THUMBNAIL_INTERVAL = 15_000

export function createThumbnailer(fileId: string, onUploaded: () => void) {
  let lastRun = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const capture = async (editor: Editor) => {
    lastRun = Date.now()
    const shapes = [...editor.getCurrentPageShapeIds()]
    const bounds = editor.getCurrentPageBounds()
    if (!shapes.length || !bounds) return
    try {
      const { blob } = await editor.toImage(shapes, {
        format: 'png',
        background: false,
        darkMode: false,
        pixelRatio: 1,
        scale: Math.min(1, THUMBNAIL_SIZE / Math.max(bounds.w, bounds.h)),
      })
      await uploadThumbnail(fileId, blob)
      onUploaded()
    } catch (error) {
      console.warn('Thumbnail capture failed', error)
    }
  }

  return {
    schedule(editor: Editor) {
      clearTimeout(timer)
      timer = setTimeout(
        () => {
          timer = undefined
          void capture(editor)
        },
        Math.max(0, lastRun + THUMBNAIL_INTERVAL - Date.now()),
      )
    },
    flush(editor: Editor) {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
      void capture(editor)
    },
  }
}
