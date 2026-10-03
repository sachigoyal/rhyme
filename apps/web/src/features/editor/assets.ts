import type { Editor, TLAssetStore } from 'tldraw'
import { publishThumbnail, uploadAsset } from '@/lib/storage'
import type { Thumbnail } from '@/lib/storage'
import type { DocumentSync } from './document-sync'
import { getEditorPreviewVersion, hasEditorPreview } from './editor-preview'

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

export function createThumbnailer(
  fileId: string,
  sync: Pick<
    DocumentSync,
    'flush' | 'getStatus' | 'getVersion' | 'getRevision'
  >,
  onUploaded: (thumbnail: Thumbnail) => void | Promise<void>,
) {
  let lastRun = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let publishing = Promise.resolve()

  const capture = async (editor: Editor) => {
    if (hasEditorPreview(editor)) return
    const previewVersion = getEditorPreviewVersion(editor)
    lastRun = Date.now()
    const revision = sync.getRevision()
    const shapes = [...editor.getCurrentPageShapeIds()]
    const bounds = editor.getCurrentPageBounds()
    if (shapes.length && !bounds) return
    try {
      const [image] = await Promise.all([
        shapes.length && bounds
          ? editor
              .toImage(shapes, {
                format: 'png',
                background: false,
                darkMode: false,
                pixelRatio: 1,
                scale: Math.min(
                  1,
                  THUMBNAIL_SIZE / Math.max(bounds.w, bounds.h),
                ),
              })
              .then(({ blob }) => blob)
          : Promise.resolve(null),
        sync.flush(),
      ])
      const version = sync.getVersion()
      const current = () =>
        !hasEditorPreview(editor) &&
        getEditorPreviewVersion(editor) === previewVersion &&
        sync.getStatus() === 'saved' &&
        sync.getRevision() === revision &&
        sync.getVersion() === version
      publishing = publishing
        .catch(() => {})
        .then(async () => {
          if (!current()) return
          const thumbnail = await publishThumbnail(fileId, version, image)
          if (thumbnail && current()) await onUploaded(thumbnail)
        })
      await publishing
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
      clearTimeout(timer)
      timer = undefined
      return capture(editor)
    },
  }
}
