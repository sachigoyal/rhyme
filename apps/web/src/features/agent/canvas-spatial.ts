import type { Bounds, CanvasShape, InspectSceneInput } from 'api/canvas-schema'
import type { Editor, Group2d, TLArrowShape } from 'tldraw'
import { describeShape, toShapeId } from './canvas-context'

export const intersects = (a: Bounds, b: Bounds, gap = 0) =>
  a.x < b.x + b.w + gap &&
  a.x + a.w + gap > b.x &&
  a.y < b.y + b.h + gap &&
  a.y + a.h + gap > b.y

export const contains = (a: Bounds, b: Bounds) =>
  a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h

export function unionBounds(items: Bounds[]): Bounds | null {
  if (!items.length) return null
  const x = Math.min(...items.map((item) => item.x))
  const y = Math.min(...items.map((item) => item.y))
  return {
    x,
    y,
    w: Math.max(...items.map((item) => item.x + item.w)) - x,
    h: Math.max(...items.map((item) => item.y + item.h)) - y,
  }
}

export function findEmptyPosition(
  size: { w: number; h: number },
  origin: { x: number; y: number },
  obstacles: Bounds[],
  gap = 64,
) {
  const fits = (point: { x: number; y: number }) =>
    !obstacles.some((box) => intersects({ ...size, ...point }, box, gap))
  if (fits(origin)) return origin
  const candidates = obstacles
    .flatMap((box) => [
      { x: box.x + box.w + gap, y: origin.y },
      { x: origin.x, y: box.y + box.h + gap },
      { x: box.x + box.w + gap, y: box.y },
      { x: box.x, y: box.y + box.h + gap },
    ])
    .sort(
      (a, b) =>
        Math.hypot(a.x - origin.x, a.y - origin.y) -
        Math.hypot(b.x - origin.x, b.y - origin.y),
    )
  const free = candidates.find(fits)
  if (free) return free
  const page = unionBounds(obstacles)
  return { x: page ? page.x + page.w + gap : origin.x, y: origin.y }
}

const segmentHits = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Bounds,
) => {
  let low = 0,
    high = 1
  const dx = b.x - a.x,
    dy = b.y - a.y
  for (const [p, q] of [
    [-dx, a.x - box.x],
    [dx, box.x + box.w - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.h - a.y],
  ]) {
    if (p === 0) {
      if (q! < 0) return false
      continue
    }
    const ratio = q! / p!
    if (p! < 0) low = Math.max(low, ratio)
    else high = Math.min(high, ratio)
    if (low > high) return false
  }
  return true
}

export function connectorObstacles(
  editor: Editor,
  arrow: TLArrowShape,
  nodes: CanvasShape[],
) {
  const description = describeShape(editor, arrow)
  const geometry = editor.getShapeGeometry<Group2d>(arrow)
  const transform = editor.getShapePageTransform(arrow)
  const points = geometry.children[0]!.vertices.map((point) =>
    transform.applyToPoint(point),
  )
  return nodes.filter(
    (node) =>
      node.id !== description?.from &&
      node.id !== description?.to &&
      node.w > 8 &&
      node.h > 8 &&
      points.some(
        (point, i) =>
          i > 0 &&
          segmentHits(points[i - 1]!, point, {
            x: node.x + 4,
            y: node.y + 4,
            w: node.w - 8,
            h: node.h - 8,
          }),
      ),
  )
}

export function inspectScene(editor: Editor, input: InspectSceneInput) {
  const all = editor.getCurrentPageShapesSorted().flatMap((shape) => {
    const described = describeShape(editor, shape, 'full')
    return described ? [described] : []
  })
  const byId = new Map(all.map((shape) => [shape.id, shape]))
  const focused = input.ids ? new Set(input.ids) : null
  const relevant = (shape: CanvasShape) =>
    (!focused || focused.has(shape.id)) &&
    (!input.region || intersects(shape, input.region))
  const issues: Array<{ kind: string; ids: string[]; message: string }> = []
  let totalIssues = 0
  const issue = (kind: string, ids: string[], message: string) => {
    totalIssues++
    if (issues.length < input.maxIssues) issues.push({ kind, ids, message })
  }
  const ancestor = (a: CanvasShape, b: CanvasShape) => {
    let parent = b.parentId
    const seen = new Set<string>()
    while (parent && !seen.has(parent)) {
      if (parent === a.id) return true
      seen.add(parent)
      parent = byId.get(parent)?.parentId
    }
    return false
  }
  const nodes = all.filter(
    (shape) => !['arrow', 'group', 'frame'].includes(shape.type),
  )
  const ordered = [...nodes].sort((a, b) => a.x - b.x)
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i]!
    for (let j = i + 1; j < ordered.length; j++) {
      const b = ordered[j]!
      if (b.x >= a.x + a.w + input.minGap) break
      if ((!relevant(a) && !relevant(b)) || ancestor(a, b) || ancestor(b, a))
        continue
      if (
        (a.type === 'text' && contains(b, a)) ||
        (b.type === 'text' && contains(a, b))
      )
        continue
      if (intersects(a, b))
        issue('overlap', [a.id, b.id], 'Shape bodies overlap')
      else if (intersects(a, b, input.minGap))
        issue('spacing', [a.id, b.id], `Less than ${input.minGap} units apart`)
    }
  }
  for (const shape of all.filter(relevant)) {
    const record = editor.getShape(toShapeId(shape.id))
    if (record && editor.isShapeOfType(record, 'arrow')) {
      for (const blocked of connectorObstacles(editor, record, nodes))
        issue(
          'connector-crossing',
          [shape.id, blocked.id],
          'Connector crosses an unrelated shape body',
        )
    }

    if (shape.type === 'arrow' && (!shape.from || !shape.to))
      issue(
        'unbound-connector',
        [shape.id],
        'Connector has a free endpoint; may be intentional',
      )
    if (shape.text && shape.labelColor === 'white' && shape.fill !== 'solid')
      issue(
        'contrast',
        [shape.id],
        'White label on an unfilled or translucent shape may be hard to read',
      )
  }
  return {
    checked: all.filter(relevant).length,
    issues,
    totalIssues,
    omittedIssues: totalIssues - issues.length,
    connections: all
      .filter(
        (shape) =>
          shape.type === 'arrow' &&
          (relevant(shape) ||
            (focused &&
              (focused.has(shape.from ?? '') || focused.has(shape.to ?? '')))),
      )
      .map(({ id, from, to, text }) => ({ id, from, to, text })),
    missing: input.ids?.filter((id) => !editor.getShape(toShapeId(id))) ?? [],
    note: 'Bounding-box checks exclude hierarchy containment and text inside shapes; crossings and free endpoints may be intentional.',
  }
}
