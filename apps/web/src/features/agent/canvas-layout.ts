import type { Editor } from 'tldraw'
import { getFontFamily } from 'tldraw'
import type { ElkNode, ELK as ElkInstance } from 'elkjs/lib/elk-api'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'
import type { DiagramNode, Layout } from 'api/canvas-schema'

export type LayoutNode = { id: string; w: number; h: number }
export type LayoutEdge = { from: string; to: string; text?: string }

const roles = {
  process: { type: 'geo', geo: 'rectangle', color: 'blue' },
  decision: { type: 'geo', geo: 'diamond', color: 'orange' },
  start: { type: 'geo', geo: 'oval', color: 'green' },
  end: { type: 'geo', geo: 'oval', color: 'red' },
  data: { type: 'geo', geo: 'trapezoid', color: 'violet' },
  external: { type: 'geo', geo: 'cloud', color: 'light-blue' },
  person: { type: 'geo', geo: 'ellipse', color: 'green' },
  service: { type: 'geo', geo: 'hexagon', color: 'violet' },
  event: { type: 'geo', geo: 'oval', color: 'orange' },
  idea: { type: 'note', geo: 'rectangle', color: 'yellow' },
  annotation: { type: 'text', geo: 'rectangle', color: 'grey' },
} as const

export function prepareDiagramNode(editor: Editor, node: DiagramNode) {
  const role = roles[node.role]
  const type = node.type ?? role.type
  const geo = node.geo ?? role.geo
  const font = node.font ?? 'sans',
    size = node.size ?? 'm'
  const theme = editor.getCurrentTheme()
  const fontSize =
    theme.fontSize *
    (type === 'text'
      ? { s: 1.125, m: 1.5, l: 2.25, xl: 2.75 }[size]
      : { s: 1.125, m: 1.375, l: 1.625, xl: 2 }[size])
  const factor = ['diamond', 'triangle', 'star', 'heart'].includes(geo)
    ? 2
    : ['ellipse', 'oval', 'hexagon', 'cloud'].includes(geo)
      ? 1.4
      : 1
  const width = type === 'note' ? 200 : (node.w ?? 280)
  const measured = editor.textMeasure.measureText(node.text, {
    fontFamily: getFontFamily(theme, font),
    fontSize,
    fontWeight: 'normal',
    fontStyle: 'normal',
    lineHeight: theme.lineHeight,
    padding: '0px',
    maxWidth: (width - 40) / factor,
  })
  const w =
    type === 'note'
      ? 200
      : (node.w ?? Math.max(180, Math.min(320, measured.w * factor + 48)))
  const wrapped = editor.textMeasure.measureText(node.text, {
    fontFamily: getFontFamily(theme, font),
    fontSize,
    fontWeight: 'normal',
    fontStyle: 'normal',
    lineHeight: theme.lineHeight,
    padding: '0px',
    maxWidth: (w - 40) / factor,
  })
  const h =
    type === 'note'
      ? Math.max(200, wrapped.h + 48)
      : Math.max(node.h ?? 80, wrapped.h * factor + 48)
  return {
    ...node,
    type,
    geo,
    color: node.color ?? role.color,
    labelColor: node.labelColor ?? 'black',
    fill: node.fill ?? 'semi',
    font,
    size,
    w,
    h,
  }
}

let elkPromise: Promise<ElkInstance> | undefined
async function getElk() {
  elkPromise ??= (async () => {
    if (typeof Worker !== 'undefined') {
      const { default: ELK } = await import('elkjs/lib/elk-api')
      return new ELK({ workerFactory: () => new Worker(workerUrl) })
    }
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
    return new ELK()
  })()
  return elkPromise
}

export async function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  layout: Layout,
) {
  if (layout.mode === 'flow') {
    const elk = await getElk()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const graph = (await Promise.race([
        elk.layout({
          id: 'scene',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': {
              right: 'RIGHT',
              down: 'DOWN',
              left: 'LEFT',
              up: 'UP',
            }[layout.direction],
            'elk.spacing.nodeNode': String(layout.gap),
            'elk.layered.spacing.nodeNodeBetweenLayers': String(layout.gap),
            'elk.spacing.componentComponent': String(layout.gap),
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.randomSeed': '1',
            'elk.padding': '[top=0,left=0,bottom=0,right=0]',
          },
          children: nodes.map((node) => ({
            id: node.id,
            width: node.w,
            height: node.h,
          })),
          edges: edges.map((edge, index) => ({
            id: `edge-${index}`,
            sources: [edge.from],
            targets: [edge.to],
            ...(edge.text
              ? {
                  labels: [
                    {
                      text: edge.text,
                      width: Math.min(300, edge.text.length * 9 + 16),
                      height: 28,
                    },
                  ],
                }
              : {}),
          })),
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error('Layout timed out; use a grid or a smaller diagram'),
              ),
            15000,
          )
        }),
      ])) as ElkNode
      return (graph.children ?? []).map((node) => ({
        id: node.id,
        x: node.x ?? 0,
        y: node.y ?? 0,
      }))
    } catch (error) {
      elk.terminateWorker()
      elkPromise = undefined
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
  const horizontal = layout.direction === 'right' || layout.direction === 'left'
  const columns =
    layout.mode === 'grid'
      ? Math.min(nodes.length, layout.columns)
      : horizontal
        ? nodes.length
        : 1
  const rows = Math.ceil(nodes.length / columns)
  const widths = Array.from({ length: columns }, (_, col) =>
    Math.max(
      ...nodes.filter((_node, i) => i % columns === col).map((node) => node.w),
    ),
  )
  const heights = Array.from({ length: rows }, (_, row) =>
    Math.max(
      ...nodes.slice(row * columns, (row + 1) * columns).map((node) => node.h),
    ),
  )
  const sumBefore = (values: number[], index: number) =>
    values.slice(0, index).reduce((sum, value) => sum + value + layout.gap, 0)
  const totalW = widths.reduce(
    (sum, width) => sum + width + layout.gap,
    -layout.gap,
  )
  const totalH = heights.reduce(
    (sum, height) => sum + height + layout.gap,
    -layout.gap,
  )
  return nodes.map((node, index) => {
    const x = sumBefore(widths, index % columns),
      y = sumBefore(heights, Math.floor(index / columns))
    return {
      id: node.id,
      x: layout.direction === 'left' ? totalW - x - node.w : x,
      y: layout.direction === 'up' ? totalH - y - node.h : y,
    }
  })
}
