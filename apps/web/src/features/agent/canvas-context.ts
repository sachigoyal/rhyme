import {
  createShapeId,
  getArrowBindings,
  renderPlaintextFromRichText,
} from 'tldraw'
import type { Editor, TLRichText, TLShape, TLShapeId } from 'tldraw'
import type {
  Bounds,
  CanvasContext,
  CanvasShape,
  ReadCanvasInput,
} from 'api/canvas-schema'

const MAX_SHAPES = 300
const SCREENSHOT_SIZE = 1024

// The model sees ids without tldraw's `shape:` prefix.
export const toAgentId = (id: TLShapeId) => id.replace(/^shape:/, '')
export const toShapeId = (id: string) => createShapeId(id)

const roundBounds = ({ x, y, w, h }: Bounds): Bounds => ({
  x: Math.round(x),
  y: Math.round(y),
  w: Math.round(w),
  h: Math.round(h),
})

export function describeShape(editor: Editor, shape: TLShape) {
  const bounds = editor.getShapePageBounds(shape)
  if (!bounds) return null

  const props = shape.props as Record<string, unknown>
  const described: CanvasShape = {
    id: toAgentId(shape.id),
    type: shape.type,
    ...roundBounds(bounds),
  }
  if (typeof props.geo === 'string') described.geo = props.geo
  if (typeof props.color === 'string') described.color = props.color
  if (shape.type === 'geo' && typeof props.fill === 'string') {
    described.fill = props.fill
  }
  if (props.richText) {
    const text = renderPlaintextFromRichText(
      editor,
      props.richText as TLRichText,
    ).trim()
    if (text) described.text = text
  }
  if (editor.isShapeOfType(shape, 'arrow')) {
    const { start, end } = getArrowBindings(editor, shape)
    if (start) described.from = toAgentId(start.toId)
    if (end) described.to = toAgentId(end.toId)
  }
  return described
}

export function describeShapes(
  editor: Editor,
  scope: ReadCanvasInput['scope'],
) {
  const viewport = editor.getViewportPageBounds()
  const all = editor.getCurrentPageShapesSorted()
  const inScope =
    scope === 'page'
      ? all
      : all.filter((shape) => {
          const bounds = editor.getShapePageBounds(shape)
          return bounds && viewport.collides(bounds)
        })

  const shapes = inScope
    .slice(0, MAX_SHAPES)
    .map((shape) => describeShape(editor, shape))
    .filter((shape) => shape !== null)

  return { shapes, offscreen: all.length - shapes.length }
}

export function describeCanvas(
  editor: Editor,
  scope: ReadCanvasInput['scope'] = 'viewport',
) {
  return {
    viewport: roundBounds(editor.getViewportPageBounds()),
    selection: editor.getSelectedShapeIds().map(toAgentId),
    ...describeShapes(editor, scope),
  }
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

async function captureViewport(editor: Editor) {
  const bounds = editor.getViewportPageBounds()
  const ids = [...editor.getCurrentPageShapeIds()].filter((id) => {
    const shapeBounds = editor.getShapePageBounds(id)
    return shapeBounds && bounds.collides(shapeBounds)
  })
  if (!ids.length) return null

  try {
    const { blob } = await editor.toImage(ids, {
      format: 'jpeg',
      quality: 0.8,
      bounds,
      padding: 0,
      background: true,
      darkMode: false,
      pixelRatio: 1,
      scale: Math.min(2, SCREENSHOT_SIZE / Math.max(bounds.w, bounds.h)),
    })
    return await toDataUrl(blob)
  } catch (error) {
    console.warn('Canvas screenshot failed', error)
    return null
  }
}

export async function buildCanvasContext(
  editor: Editor,
): Promise<CanvasContext> {
  return {
    ...describeCanvas(editor),
    screenshot: await captureViewport(editor),
  }
}
