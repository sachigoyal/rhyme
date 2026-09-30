import { createShapeId, toRichText } from 'tldraw'
import type { Editor, TLShapeId, VecModel } from 'tldraw'
import { z } from 'zod'
import { canvasToolInputs, isCanvasTool } from 'api/canvas-schema'
import type {
  CreateShapesInput,
  DeleteShapesInput,
  NewShape,
  UpdateShapesInput,
} from 'api/canvas-schema'
import {
  describeCanvas,
  describeShape,
  toAgentId,
  toShapeId,
} from './canvas-context'

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const defined = <T extends Record<string, unknown>>(object: T) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>

export function parseToolInput<TName extends keyof typeof canvasToolInputs>(
  name: TName,
  input: unknown,
): z.output<(typeof canvasToolInputs)[TName]> {
  const parsed = canvasToolInputs[name].safeParse(input)
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error))
  return parsed.data as z.output<(typeof canvasToolInputs)[TName]>
}

type Resolve = (id: string) => TLShapeId

function createShape(
  editor: Editor,
  shape: NewShape,
  id: TLShapeId,
  resolve: Resolve,
) {
  const richText = shape.text ? toRichText(shape.text) : undefined

  switch (shape.type) {
    case 'geo':
      editor.createShape({
        id,
        type: 'geo',
        x: shape.x,
        y: shape.y,
        props: defined({
          geo: shape.geo,
          w: shape.w,
          h: shape.h,
          richText,
          color: shape.color,
          fill: shape.fill,
        }),
      })
      return
    case 'text':
      editor.createShape({
        id,
        type: 'text',
        x: shape.x,
        y: shape.y,
        props: defined({
          richText,
          size: shape.size,
          color: shape.color,
          ...(shape.w ? { w: shape.w, autoSize: false } : {}),
        }),
      })
      return
    case 'note':
      editor.createShape({
        id,
        type: 'note',
        x: shape.x,
        y: shape.y,
        props: defined({ richText, color: shape.color }),
      })
      return
    case 'arrow':
      createArrow(editor, shape, id, resolve)
  }
}

function createArrow(
  editor: Editor,
  shape: Extract<NewShape, { type: 'arrow' }>,
  id: TLShapeId,
  resolve: Resolve,
) {
  const endpoint = (end: string | VecModel) => {
    if (typeof end !== 'string') return { point: end, target: null }
    const target = resolve(end)
    const bounds = editor.getShapePageBounds(target)
    if (!bounds) throw new Error(`No shape with id "${end}"`)
    return { point: bounds.center, target }
  }
  const start = endpoint(shape.from)
  const end = endpoint(shape.to)
  if (start.target && start.target === end.target) {
    throw new Error('An arrow cannot start and end on the same shape')
  }

  editor.createShape({
    id,
    type: 'arrow',
    x: start.point.x,
    y: start.point.y,
    props: defined({
      start: { x: 0, y: 0 },
      end: { x: end.point.x - start.point.x, y: end.point.y - start.point.y },
      richText: shape.text ? toRichText(shape.text) : undefined,
      color: shape.color,
    }),
  })

  for (const [terminal, { target }] of [
    ['start', start],
    ['end', end],
  ] as const) {
    if (!target) continue
    editor.createBinding({
      type: 'arrow',
      fromId: id,
      toId: target,
      props: {
        terminal,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
        snap: 'none',
      },
    })
  }
}

export function createShapes(editor: Editor, { shapes }: CreateShapesInput) {
  // Model-chosen ids that collide with existing shapes get fresh ones; later refs follow the alias.
  const aliases = new Map<string, TLShapeId>()
  const resolve: Resolve = (id) => aliases.get(id) ?? toShapeId(id)
  const created: TLShapeId[] = []
  const errors: Array<{ index: number; error: string }> = []

  editor.run(() => {
    shapes.forEach((shape, index) => {
      const requested = shape.id && toShapeId(shape.id)
      const id =
        requested && !editor.getShape(requested) ? requested : createShapeId()
      try {
        createShape(editor, shape, id, resolve)
        if (shape.id) aliases.set(shape.id, id)
        created.push(id)
      } catch (error) {
        errors.push({ index, error: errorText(error) })
      }
    })
  })

  return {
    created: created.flatMap((id) => {
      const shape = editor.getShape(id)
      const described = shape && describeShape(editor, shape)
      return described ? [described] : []
    }),
    ...(errors.length ? { errors } : {}),
  }
}

export function updateShapes(editor: Editor, { updates }: UpdateShapesInput) {
  const updated: string[] = []
  const errors: Array<{ id: string; error: string }> = []

  editor.run(() => {
    for (const update of updates) {
      const shape = editor.getShape(toShapeId(update.id))
      const bounds = shape && editor.getShapePageBounds(shape)
      if (!shape || !bounds) {
        errors.push({ id: update.id, error: 'Shape not found' })
        continue
      }

      const current = shape.props as Record<string, unknown>
      const props: Record<string, unknown> = {}
      const ignored: string[] = []
      const set = (field: string, value: unknown, allowed: boolean) => {
        if (value === undefined) return
        if (allowed) props[field] = value
        else ignored.push(field)
      }

      set(
        'richText',
        update.text === undefined ? undefined : toRichText(update.text),
        'richText' in current,
      )
      set('color', update.color, 'color' in current)
      set('fill', update.fill, shape.type === 'geo')
      set('geo', update.geo, shape.type === 'geo')
      set('w', update.w, shape.type === 'geo' || shape.type === 'text')
      set('h', update.h, shape.type === 'geo')
      if (shape.type === 'text' && update.w !== undefined) {
        props.autoSize = false
      }

      // Inputs are page coordinates; shape.x/y are relative to the parent.
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        x: shape.x + (update.x ?? bounds.x) - bounds.x,
        y: shape.y + (update.y ?? bounds.y) - bounds.y,
        props,
      })

      updated.push(update.id)
      if (ignored.length) {
        errors.push({
          id: update.id,
          error: `Ignored ${ignored.join(', ')} for a ${shape.type} shape`,
        })
      }
    }
  })

  return { updated, ...(errors.length ? { errors } : {}) }
}

export function deleteShapes(editor: Editor, { ids }: DeleteShapesInput) {
  const existing = ids
    .map(toShapeId)
    .filter((id) => editor.getShape(id) !== undefined)
  editor.deleteShapes(existing)
  const deleted = existing.map(toAgentId)
  const missing = ids.filter((id) => !deleted.includes(id))
  return { deleted, ...(missing.length ? { missing } : {}) }
}

// Applies every tool except delete_shapes, which waits for the user's approval.
export function runCanvasTool(editor: Editor, name: string, input: unknown) {
  if (!isCanvasTool(name)) throw new Error(`Unknown tool "${name}"`)

  switch (name) {
    case 'read_canvas':
      return describeCanvas(editor, parseToolInput(name, input).scope)
    case 'create_shapes':
      return createShapes(editor, parseToolInput(name, input))
    case 'update_shapes':
      return updateShapes(editor, parseToolInput(name, input))
    case 'delete_shapes':
      return deleteShapes(editor, parseToolInput(name, input))
  }
}
