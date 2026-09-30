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
  color: color.optional(),
  fill: z.enum(FILLS).optional(),
})

const textShape = z.object({
  type: z.literal('text'),
  id: newId,
  x: coordinate,
  y: coordinate,
  text: z.string().min(1).max(5000),
  w: size.optional().describe('Fixed width to wrap at; omit to auto-size'),
  size: z.enum(TEXT_SIZES).optional(),
  color: color.optional(),
})

const noteShape = z.object({
  type: z.literal('note'),
  id: newId,
  x: coordinate,
  y: coordinate,
  text: z.string().max(2000),
  color: color.optional(),
})

const arrowEnd = z
  .union([shapeId, point])
  .describe('A shape id to bind to, or a free page point')

const arrowShape = z.object({
  type: z.literal('arrow'),
  id: newId,
  from: arrowEnd,
  to: arrowEnd,
  text: z.string().max(500).optional(),
  color: color.optional(),
})

export const newShape = z.discriminatedUnion('type', [
  geoShape,
  textShape,
  noteShape,
  arrowShape,
])

export const readCanvasInput = z.object({
  scope: z
    .enum(['viewport', 'page'])
    .default('viewport')
    .describe('viewport: shapes on screen; page: every shape on the page'),
})

export const createShapesInput = z.object({
  shapes: z.array(newShape).min(1).max(50),
})

export const updateShapesInput = z.object({
  updates: z
    .array(
      z.object({
        id: shapeId,
        x: coordinate.optional(),
        y: coordinate.optional(),
        w: size.optional(),
        h: size.optional(),
        text: z.string().max(5000).optional(),
        color: color.optional(),
        fill: z.enum(FILLS).optional(),
        geo: z.enum(GEO_KINDS).optional(),
      }),
    )
    .min(1)
    .max(50),
})

export const deleteShapesInput = z.object({
  ids: z.array(shapeId).min(1).max(100),
})

export const canvasToolInputs = {
  read_canvas: readCanvasInput,
  create_shapes: createShapesInput,
  update_shapes: updateShapesInput,
  delete_shapes: deleteShapesInput,
}

export type CanvasToolName = keyof typeof canvasToolInputs

export const isCanvasTool = (name: string): name is CanvasToolName =>
  name in canvasToolInputs

export const bounds = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})

export const canvasShape = z.object({
  id: z.string(),
  type: z.string(),
  geo: z.string().optional(),
  text: z.string().optional(),
  color: z.string().optional(),
  fill: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ...bounds.shape,
})

export const canvasContext = z.object({
  viewport: bounds,
  selection: z.array(z.string()).max(500),
  shapes: z.array(canvasShape).max(500),
  offscreen: z.number().int().nonnegative(),
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
