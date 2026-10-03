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

const SCREENSHOT_SIZE = 1024

// The model sees ids without tldraw's `shape:` prefix.
export const toAgentId = (id: TLShapeId) => id.replace(/^shape:/, '')
export const toShapeId = (id: string) => createShapeId(id)

const roundBounds = ({ x, y, w, h }: Bounds) => ({
  x: Math.round(x),
  y: Math.round(y),
  w: Math.round(w),
  h: Math.round(h),
})

export function describeShape(
  editor: Editor,
  shape: TLShape,
  detail: 'standard' | 'full' = 'standard',
) {
  const bounds = editor.getShapePageBounds(shape)
  if (!bounds) return null

  const props = shape.props as Record<string, unknown>
  const described: CanvasShape = {
    id: toAgentId(shape.id),
    type: shape.type,
    ...roundBounds(bounds),
  }
  if (shape.parentId.startsWith('shape:'))
    described.parentId = toAgentId(shape.parentId as TLShapeId)
  if (shape.rotation)
    described.rotation = Math.round((shape.rotation * 180) / Math.PI)
  if (shape.isLocked) described.locked = true
  for (const field of [
    'size',
    'labelColor',
    'font',
    'dash',
    'align',
    'verticalAlign',
    'kind',
    'arrowheadStart',
    'arrowheadEnd',
  ] as const) {
    if (detail === 'standard' && field !== 'size' && field !== 'labelColor')
      continue
    if (typeof props[field] === 'string') described[field] = props[field]
  }
  if (detail === 'full') {
    for (const field of ['bend', 'labelPosition', 'elbowMidPoint'] as const)
      if (typeof props[field] === 'number') described[field] = props[field]
  }
  if (typeof props.geo === 'string') described.geo = props.geo
  if (typeof props.color === 'string') described.color = props.color
  if (
    (shape.type === 'geo' || shape.type === 'draw') &&
    typeof props.fill === 'string'
  ) {
    described.fill = props.fill
  }
  if (shape.type === 'draw' && typeof props.isClosed === 'boolean')
    described.closed = props.isClosed
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
    if (detail === 'full') {
      if (start) described.fromAnchor = start.props.normalizedAnchor
      else
        described.fromPoint = editor
          .getShapePageTransform(shape)
          .applyToPoint(shape.props.start)
      if (end) described.toAnchor = end.props.normalizedAnchor
      else
        described.toPoint = editor
          .getShapePageTransform(shape)
          .applyToPoint(shape.props.end)
    }
  }
  return described
}

const collides = (a: Bounds, b: Bounds) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const combine = (items: Bounds[]) => {
  if (!items.length) return null
  const x = Math.min(...items.map((item) => item.x)),
    y = Math.min(...items.map((item) => item.y))
  return roundBounds({
    x,
    y,
    w: Math.max(...items.map((item) => item.x + item.w)) - x,
    h: Math.max(...items.map((item) => item.y + item.h)) - y,
  })
}

function summarizeClusters(shapes: CanvasShape[]) {
  let cell = 1024
  let buckets: Map<string, CanvasShape[]>
  do {
    buckets = new Map()
    for (const shape of shapes) {
      const key = `${Math.floor(shape.x / cell)},${Math.floor(shape.y / cell)}`
      const bucket = buckets.get(key) ?? []
      bucket.push(shape)
      buckets.set(key, bucket)
    }
    cell *= 2
  } while (buckets.size > 32)
  return [...buckets.values()].map((items) => ({
    ...combine(items)!,
    count: items.length,
    labels: items
      .filter((item) => item.text)
      .slice(0, 3)
      .map((item) => item.text!.slice(0, 100)),
  }))
}

export function describeShapes(
  editor: Editor,
  options: Partial<ReadCanvasInput> | ReadCanvasInput['scope'] = {},
) {
  const input = typeof options === 'string' ? { scope: options } : options
  const viewport = editor.getViewportPageBounds()
  const selection = new Set(editor.getSelectedShapeIds().map(toAgentId))
  const all = editor.getCurrentPageShapesSorted().flatMap((shape) => {
    const described = describeShape(editor, shape, input.detail)
    return described ? [described] : []
  })
  const wanted = input.ids && new Set(input.ids)
  const scoped = all.filter((shape) =>
    wanted
      ? wanted.has(shape.id)
      : input.scope === 'page'
        ? true
        : input.scope === 'selection'
          ? selection.has(shape.id)
          : collides(viewport, shape) || selection.has(shape.id),
  )
  const matched = scoped.filter(
    (shape) =>
      (!input.region || collides(input.region, shape)) &&
      (!input.text ||
        shape.text?.toLowerCase().includes(input.text.toLowerCase())) &&
      (!input.types || input.types.includes(shape.type)),
  )
  const prioritized = matched
    .filter((shape) => selection.has(shape.id))
    .concat(matched.filter((shape) => !selection.has(shape.id)))
  const offset = input.offset ?? 0,
    limit = input.limit ?? 300
  const shapes: CanvasShape[] = []
  let chars = 0
  for (const shape of prioritized.slice(offset, offset + limit)) {
    const length = JSON.stringify(shape).length
    if (shapes.length && chars + length > (input.maxChars ?? 160000)) break
    shapes.push(shape)
    chars += length
  }
  const offscreen = all.filter((shape) => !collides(viewport, shape))
  const counts: Record<string, number> = {}
  for (const shape of all) counts[shape.type] = (counts[shape.type] ?? 0) + 1
  return {
    shapes,
    total: all.length,
    matched: matched.length,
    omitted: matched.length - shapes.length,
    nextOffset:
      offset + shapes.length < matched.length ? offset + shapes.length : null,
    offscreen: offscreen.length,
    pageBounds: combine(all),
    counts,
    clusters: summarizeClusters(offscreen),
    ...(wanted
      ? {
          missing: input.ids!.filter(
            (id) => !all.some((shape) => shape.id === id),
          ),
        }
      : {}),
  }
}

export function describeCanvas(
  editor: Editor,
  options: Partial<ReadCanvasInput> | ReadCanvasInput['scope'] = {},
) {
  return {
    viewport: roundBounds(editor.getViewportPageBounds()),
    selection: editor.getSelectedShapeIds().map(toAgentId),
    ...describeShapes(editor, options),
  }
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export async function captureCanvasPreview(
  editor: Editor,
  size = SCREENSHOT_SIZE,
) {
  const bounds = editor.getViewportPageBounds()
  const ids = [...editor.getCurrentPageShapeIds()].filter((id) => {
    const shapeBounds = editor.getShapePageBounds(id)
    return shapeBounds && bounds.collides(shapeBounds)
  })
  if (!ids.length) return null

  try {
    const { blob } = await editor.toImage(ids, {
      format: 'jpeg',
      quality: size < SCREENSHOT_SIZE ? 0.65 : 0.8,
      bounds,
      padding: 0,
      background: true,
      darkMode: editor.user.getIsDarkMode(),
      pixelRatio: 1,
      scale: Math.min(2, size / Math.max(bounds.w, bounds.h)),
    })
    return await toDataUrl(blob)
  } catch (error) {
    console.warn('Canvas screenshot failed', error)
    return null
  }
}

export async function buildCanvasContext(
  editor: Editor,
  includeScreenshot = true,
) {
  return {
    ...describeCanvas(editor, { limit: 500, maxChars: 100000 }),
    screenshot: includeScreenshot ? await captureCanvasPreview(editor) : null,
  } satisfies CanvasContext
}
