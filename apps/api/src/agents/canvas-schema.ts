import { z } from 'zod'

// Shared with the web app, which validates every tool call before touching the editor.

export const COLORS = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white',
] as const

export const GEO_KINDS = [
  'rectangle',
  'ellipse',
  'oval',
  'triangle',
  'diamond',
  'rhombus',
  'trapezoid',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
  'cloud',
  'heart',
  'x-box',
  'check-box',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
] as const

export const FILLS = ['none', 'semi', 'solid', 'pattern'] as const
export const TEXT_SIZES = ['s', 'm', 'l', 'xl'] as const

const shapeId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\w-]+$/, 'Use letters, numbers, - or _')
const coordinate = z.number().finite().min(-1e6).max(1e6)
const size = z.number().finite().min(1).max(1e5)
const point = z.object({ x: coordinate, y: coordinate })
const color = z.enum(COLORS)
export const bounds = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().nonnegative(),
  h: z.number().finite().nonnegative(),
})
const ids = z.array(shapeId).min(1).max(500)
const styles = {
  color: color.optional(),
  labelColor: color.optional(),
  fill: z.enum(FILLS).optional(),
  size: z.enum(TEXT_SIZES).optional(),
  font: z.enum(['draw', 'sans', 'serif', 'mono']).optional(),
  dash: z.enum(['draw', 'solid', 'dashed', 'dotted']).optional(),
  align: z.enum(['start', 'middle', 'end']).optional(),
  verticalAlign: z.enum(['start', 'middle', 'end']).optional(),
}
const arrowStyles = {
  kind: z.enum(['arc', 'elbow']).optional(),
  labelPosition: z.number().min(0).max(1).optional(),
  elbowMidPoint: z.number().min(0).max(1).optional(),
  bend: z.number().finite().min(-10000).max(10000).optional(),
  arrowheadStart: z
    .enum(['none', 'arrow', 'triangle', 'dot', 'diamond', 'bar'])
    .optional(),
  arrowheadEnd: z
    .enum(['none', 'arrow', 'triangle', 'dot', 'diamond', 'bar'])
    .optional(),
}

const newId = shapeId
  .optional()
  .describe(
    'Optional id so later shapes in this call (e.g. arrows) can refer to it',
  )

const geoShape = z.object({
  type: z.literal('geo'),
  id: newId,
  geo: z.enum(GEO_KINDS).default('rectangle'),
  x: coordinate,
  y: coordinate,
  w: size,
  h: size,
  text: z.string().max(2000).optional(),
  ...styles,
})

const textShape = z.object({
  type: z.literal('text'),
  id: newId,
  x: coordinate,
  y: coordinate,
  text: z.string().min(1).max(5000),
  w: size.optional().describe('Fixed width to wrap at; omit to auto-size'),
  ...styles,
})

const noteShape = z.object({
  type: z.literal('note'),
  id: newId,
  x: coordinate,
  y: coordinate,
  text: z.string().max(2000),
  ...styles,
})

const anchor = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

const arrowEnd = z
  .union([shapeId, point])
  .describe('A shape id to bind to, or a free page point')

const arrowShape = z.object({
  type: z.literal('arrow'),
  id: newId,
  from: arrowEnd,
  to: arrowEnd,
  fromAnchor: anchor.optional(),
  toAnchor: anchor.optional(),
  text: z.string().max(500).optional(),
  ...styles,
  ...arrowStyles,
})

export const newShape = z.discriminatedUnion('type', [
  geoShape,
  textShape,
  noteShape,
  arrowShape,
])

export const readCanvasInput = z.object({
  scope: z.enum(['viewport', 'page', 'selection']).default('viewport'),
  ids: ids.optional().describe('Exact shape ids; overrides scope'),
  region: bounds
    .optional()
    .describe('Only shapes intersecting this page region'),
  text: z
    .string()
    .max(500)
    .optional()
    .describe('Case-insensitive label search'),
  types: z.array(z.string().min(1).max(64)).max(20).optional(),
  detail: z.enum(['standard', 'full']).default('standard'),
  offset: z.number().int().min(0).max(100000).default(0),
  limit: z.number().int().min(1).max(1000).default(300),
  maxChars: z
    .number()
    .int()
    .min(8192)
    .max(500000)
    .default(160000)
    .describe(
      'Response character budget; complete shape labels are preserved, follow nextOffset for more',
    ),
})

export const createShapesInput = z.object({
  shapes: z.array(newShape).min(1).max(200),
})
const shapePatch = z.object({
  x: coordinate.optional(),
  y: coordinate.optional(),
  dx: coordinate.optional().describe('Relative page-space movement'),
  dy: coordinate.optional(),
  w: size.optional(),
  h: size.optional(),
  rotation: z
    .number()
    .finite()
    .min(-360)
    .max(360)
    .optional()
    .describe('Local rotation in degrees'),
  text: z.string().max(5000).optional(),
  geo: z.enum(GEO_KINDS).optional(),
  ...styles,
  ...arrowStyles,
})
export const updateShapesInput = z
  .object({
    updates: z
      .array(shapePatch.extend({ id: shapeId }))
      .min(1)
      .max(200)
      .optional(),
    ids: ids.optional(),
    patch: shapePatch.optional().describe('One shared patch applied to ids'),
  })
  .refine(
    (value) => Boolean(value.updates || (value.ids && value.patch)),
    'Provide updates or both ids and patch',
  )

export const deleteShapesInput = z.object({ ids })
const layout = z.object({
  mode: z.enum(['flow', 'grid', 'stack']).default('flow'),
  direction: z.enum(['right', 'down', 'left', 'up']).default('right'),
  gap: z.number().finite().min(24).max(1000).default(64),
  columns: z.number().int().min(1).max(50).default(4),
})
export const arrangeShapesInput = z.object({
  ids,
  operation: z
    .enum([
      'layout',
      'align-left',
      'align-right',
      'align-top',
      'align-bottom',
      'align-center-horizontal',
      'align-center-vertical',
      'distribute-horizontal',
      'distribute-vertical',
      'pack',
    ])
    .default('layout'),
  layout: layout.default({
    mode: 'grid',
    direction: 'right',
    gap: 64,
    columns: 4,
  }),
  origin: point
    .optional()
    .describe('Page position; defaults to existing bounds'),
})
export const connectShapesInput = z.object({
  connections: z
    .array(
      arrowShape.omit({ type: true }).extend({
        arrowId: shapeId
          .optional()
          .describe('Rebind an existing arrow instead of creating a new one'),
      }),
    )
    .min(1)
    .max(200),
})
const diagramNode = z.object({
  id: shapeId,
  text: z.string().max(2000),
  role: z
    .enum([
      'process',
      'decision',
      'start',
      'end',
      'data',
      'external',
      'person',
      'service',
      'event',
      'idea',
      'annotation',
    ])
    .default('process'),
  type: z.enum(['geo', 'note', 'text']).optional(),
  geo: z.enum(GEO_KINDS).optional(),
  w: size.optional(),
  h: size.optional(),
  ...styles,
})
export const createDiagramInput = z.object({
  nodes: z.array(diagramNode).min(1).max(200),
  edges: z
    .array(
      arrowShape.omit({ type: true, from: true, to: true }).extend({
        from: shapeId,
        to: shapeId,
      }),
    )
    .max(400)
    .default([]),
  layout: layout.default({
    mode: 'flow',
    direction: 'right',
    gap: 64,
    columns: 4,
  }),
  origin: point.optional(),
  avoidExisting: z
    .boolean()
    .default(true)
    .describe('Find empty space near origin or viewport'),
})
export const inspectSceneInput = z.object({
  ids: ids.optional(),
  region: bounds.optional(),
  minGap: z.number().finite().min(0).max(200).default(24),
  maxIssues: z.number().int().min(1).max(200).default(50),
})
export const canvasToolInputs = {
  read_canvas: readCanvasInput,
  create_shapes: createShapesInput,
  update_shapes: updateShapesInput,
  delete_shapes: deleteShapesInput,
  arrange_shapes: arrangeShapesInput,
  connect_shapes: connectShapesInput,
  create_diagram: createDiagramInput,
  inspect_scene: inspectSceneInput,
}
export type CanvasToolName = keyof typeof canvasToolInputs
export const isCanvasTool = (name: string): name is CanvasToolName =>
  Object.hasOwn(canvasToolInputs, name)
export const isCanvasMutation = (name: string) =>
  isCanvasTool(name) && name !== 'read_canvas' && name !== 'inspect_scene'

export const canvasShape = z.object({
  id: z.string(),
  type: z.string(),
  geo: z.string().optional(),
  text: z.string().optional(),
  color: z.string().optional(),
  fill: z.string().optional(),
  parentId: z.string().optional(),
  rotation: z.number().optional(),
  locked: z.boolean().optional(),
  size: z.string().optional(),
  font: z.string().optional(),
  labelColor: z.string().optional(),
  dash: z.string().optional(),
  align: z.string().optional(),
  verticalAlign: z.string().optional(),
  kind: z.string().optional(),
  bend: z.number().optional(),
  labelPosition: z.number().optional(),
  elbowMidPoint: z.number().optional(),
  fromAnchor: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
  toAnchor: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
  fromPoint: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
  toPoint: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
  arrowheadStart: z.string().optional(),
  arrowheadEnd: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ...bounds.shape,
})

export const canvasContext = z.object({
  viewport: bounds,
  selection: z.array(z.string()).max(500),
  shapes: z.array(canvasShape).max(1000),
  offscreen: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().optional(),
  matched: z.number().int().nonnegative().optional(),
  omitted: z.number().int().nonnegative().optional(),
  nextOffset: z.number().int().nullable().optional(),
  pageBounds: bounds.nullable().optional(),
  counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  clusters: z
    .array(
      bounds.extend({ count: z.number().int(), labels: z.array(z.string()) }),
    )
    .max(32)
    .optional(),

  screenshot: z
    .string()
    .regex(/^data:image\/(jpeg|png);base64,/)
    .max(2_000_000)
    .nullable(),
})

export type Bounds = z.infer<typeof bounds>
export type CanvasShape = z.infer<typeof canvasShape>
export type CanvasContext = z.infer<typeof canvasContext>
export type NewShape = z.infer<typeof newShape>
export type ReadCanvasInput = z.infer<typeof readCanvasInput>
export type CreateShapesInput = z.infer<typeof createShapesInput>
export type UpdateShapesInput = z.infer<typeof updateShapesInput>
export type DeleteShapesInput = z.infer<typeof deleteShapesInput>

export type ArrangeShapesInput = z.infer<typeof arrangeShapesInput>
export type ConnectShapesInput = z.infer<typeof connectShapesInput>
export type CreateDiagramInput = z.infer<typeof createDiagramInput>
export type DiagramNode = z.infer<typeof diagramNode>
export type Layout = z.infer<typeof layout>
export type InspectSceneInput = z.infer<typeof inspectSceneInput>
