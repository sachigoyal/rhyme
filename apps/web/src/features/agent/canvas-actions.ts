import { createShapeId, toRichText } from 'tldraw'
import type { Editor, TLShapeId, VecModel } from 'tldraw'
import { z } from 'zod'
import { canvasToolInputs, isCanvasTool } from 'api/canvas-schema'
import type {
  CreateShapesInput,
  DeleteShapesInput,
  NewShape,
  UpdateShapesInput,
  ArrangeShapesInput,
  ConnectShapesInput,
  CreateDiagramInput,
} from 'api/canvas-schema'
import {
  describeCanvas,
  describeShape,
  toAgentId,
  toShapeId,
} from './canvas-context'
import { computeLayout, prepareDiagramNode } from './canvas-layout'
import {
  findEmptyPosition,
  inspectScene,
  unionBounds,
  connectorObstacles,
} from './canvas-spatial'

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const defined = <T extends Record<string, unknown>>(object: T) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>

export function parseToolInput<TName extends keyof typeof canvasToolInputs>(
  name: TName,
  input: unknown,
) {
  const parsed = canvasToolInputs[name].safeParse(input)
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error))
  return parsed.data as z.output<(typeof canvasToolInputs)[TName]>
}

const styleProps = (
  type: string,
  shape: Record<string, unknown>,
): Record<string, unknown> => {
  const fields =
    type === 'geo'
      ? [
          'color',
          'labelColor',
          'fill',
          'size',
          'font',
          'dash',
          'align',
          'verticalAlign',
        ]
      : type === 'note'
        ? ['color', 'labelColor', 'size', 'font', 'align', 'verticalAlign']
        : type === 'text'
          ? ['color', 'size', 'font']
          : [
              'color',
              'labelColor',
              'size',
              'font',
              'dash',
              'kind',
              'bend',
              'arrowheadStart',
              'arrowheadEnd',
              'labelPosition',
              'elbowMidPoint',
            ]
  return defined({
    ...Object.fromEntries(fields.map((field) => [field, shape[field]])),
    ...(type === 'text' ? { textAlign: shape.align } : {}),
  })
}

function ensureUniqueIds(items: Array<{ id?: string }>) {
  const ids = items.flatMap((item) => (item.id ? [item.id] : []))
  if (new Set(ids).size !== ids.length)
    throw new Error(
      'Duplicate ids in this batch; use a distinct id for every shape',
    )
}

function editable(editor: Editor, id: TLShapeId) {
  const shape = editor.getShape(id)
  if (!shape) throw new Error(`Shape not found: ${toAgentId(id)}`)
  if (editor.isShapeOrAncestorLocked(shape))
    throw new Error(`Shape is locked: ${toAgentId(id)}`)
  return shape
}

export function moveShapeTo(
  editor: Editor,
  id: TLShapeId,
  x: number,
  y: number,
) {
  const shape = editable(editor, id)
  const bounds = editor.getShapePageBounds(shape)
  if (!bounds) throw new Error('Shape has no page bounds')
  const transform = editor.getShapeParentTransform(shape)
  const origin = transform.applyToPoint({ x: shape.x, y: shape.y })
  const local = editor.getPointInParentSpace(shape, {
    x: origin.x + x - bounds.x,
    y: origin.y + y - bounds.y,
  })
  editor.updateShape({ id, type: shape.type, x: local.x, y: local.y })
}

function descriptions(editor: Editor, ids: TLShapeId[]) {
  return ids.flatMap((id) => {
    const shape = editor.getShape(id)
    const described = shape && describeShape(editor, shape, 'full')
    return described ? [described] : []
  })
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
          ...styleProps(shape.type, shape),
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
          ...styleProps(shape.type, shape),
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
        props: defined({ richText, ...styleProps(shape.type, shape) }),
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

  const existing = editor.getShape(id)
  const origin = existing
    ? editor.getPointInParentSpace(existing, start.point)
    : start.point
  const finish = existing
    ? editor.getPointInParentSpace(existing, end.point)
    : end.point
  const record = {
    id,
    type: 'arrow' as const,
    x: origin.x,
    y: origin.y,
    rotation: 0,
    props: defined({
      start: { x: 0, y: 0 },
      end: { x: finish.x - origin.x, y: finish.y - origin.y },
      richText: shape.text === undefined ? undefined : toRichText(shape.text),
      ...styleProps(shape.type, shape),
    }),
  }
  if (existing) {
    editor.deleteBindings(editor.getBindingsFromShape(id, 'arrow'))
    editor.updateShape(record)
  } else editor.createShape(record)

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
        normalizedAnchor: (terminal === 'start'
          ? shape.fromAnchor
          : shape.toAnchor) ?? { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: Boolean(
          terminal === 'start' ? shape.fromAnchor : shape.toAnchor,
        ),
        snap: (terminal === 'start' ? shape.fromAnchor : shape.toAnchor)
          ? 'edge'
          : 'none',
      },
    })
  }
}

export function createShapes(editor: Editor, { shapes }: CreateShapesInput) {
  ensureUniqueIds(shapes)
  const aliases = new Map<string, TLShapeId>()
  const planned = shapes.map((shape) => {
    const requested = shape.id && toShapeId(shape.id)
    const id =
      requested && !editor.getShape(requested) ? requested : createShapeId()
    if (shape.id) aliases.set(shape.id, id)
    return { shape, id }
  })
  const resolve: Resolve = (id) => aliases.get(id) ?? toShapeId(id)
  const available = new Set([
    ...planned.map((item) => item.id),
    ...editor.getCurrentPageShapesSorted().map((shape) => shape.id),
  ])
  for (const { shape } of planned) {
    if (shape.type !== 'arrow') continue
    for (const end of [shape.from, shape.to])
      if (typeof end === 'string' && !available.has(resolve(end)))
        throw new Error(`No shape with id "${end}"; nothing was created`)
    if (typeof shape.from === 'string' && shape.from === shape.to)
      throw new Error('An arrow cannot start and end on the same shape')
    for (const end of [shape.from, shape.to]) {
      if (
        typeof end === 'string' &&
        planned.some(
          (item) => item.id === resolve(end) && item.shape.type === 'arrow',
        )
      )
        throw new Error('Connect to a node, not another arrow')
    }
  }
  const created: TLShapeId[] = []
  const errors: Array<{ index: number; error: string }> = []
  editor.run(() => {
    for (const { shape, id } of [
      ...planned.filter((item) => item.shape.type !== 'arrow'),
      ...planned.filter((item) => item.shape.type === 'arrow'),
    ]) {
      try {
        createShape(editor, shape, id, resolve)
        created.push(id)
      } catch (error) {
        errors.push({ index: shapes.indexOf(shape), error: errorText(error) })
      }
    }
  })
  return {
    created: descriptions(editor, created),
    aliases: Object.fromEntries(
      [...aliases].map(([alias, id]) => [alias, toAgentId(id)]),
    ),
    ...(errors.length ? { errors } : {}),
  }
}

export function updateShapes(editor: Editor, input: UpdateShapesInput) {
  const updates = [
    ...(input.ids?.map((id) => ({ ...input.patch, id })) ?? []),
    ...(input.updates ?? []),
  ]
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

      if (editor.isShapeOrAncestorLocked(shape)) {
        errors.push({ id: update.id, error: 'Shape is locked' })
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
      for (const [field, value] of Object.entries(
        styleProps(shape.type, update),
      ))
        set(field, value, field in current)

      set('fill', update.fill, shape.type === 'geo')
      set('geo', update.geo, shape.type === 'geo')
      set('w', update.w, shape.type === 'geo' || shape.type === 'text')
      set('h', update.h, shape.type === 'geo')
      if (shape.type === 'text' && update.w !== undefined) {
        props.autoSize = false
      }

      try {
        if (
          update.x !== undefined ||
          update.y !== undefined ||
          update.dx !== undefined ||
          update.dy !== undefined
        ) {
          moveShapeTo(
            editor,
            shape.id,
            (update.x ?? bounds.x) + (update.dx ?? 0),
            (update.y ?? bounds.y) + (update.dy ?? 0),
          )
        }
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          ...(update.rotation === undefined
            ? {}
            : { rotation: (update.rotation * Math.PI) / 180 }),
          props,
          ...(update.kind !== undefined || update.bend !== undefined
            ? { meta: { ...shape.meta, rhymeAutoRoute: false } }
            : {}),
        })

        updated.push(update.id)
      } catch (error) {
        errors.push({ id: update.id, error: errorText(error) })
        continue
      }
      if (ignored.length) {
        errors.push({
          id: update.id,
          error: `Ignored ${ignored.join(', ')} for a ${shape.type} shape`,
        })
      }
    }
  })

  return {
    updated,
    shapes: descriptions(editor, updated.map(toShapeId)),
    ...(errors.length ? { errors } : {}),
  }
}

export function deleteShapes(editor: Editor, { ids }: DeleteShapesInput) {
  const unique = [...new Set(ids)]
  const missing = unique.filter((id) => !editor.getShape(toShapeId(id)))
  const errors: Array<{ id: string; error: string }> = []
  const existing = unique
    .filter((id) => !missing.includes(id))
    .map(toShapeId)
    .filter((id) => {
      const locked = [...editor.getShapeAndDescendantIds([id])].some((child) =>
        editor.isShapeOrAncestorLocked(child),
      )
      if (locked)
        errors.push({
          id: toAgentId(id),
          error: 'Shape or descendant is locked',
        })
      return !locked
    })
  editor.deleteShapes(existing)
  return {
    deleted: existing.map(toAgentId),
    ...(missing.length ? { missing } : {}),
    ...(errors.length ? { errors } : {}),
  }
}

function routeConnectors(editor: Editor, ids: TLShapeId[]) {
  const nodes = editor
    .getCurrentPageShapesSorted()
    .filter((shape) => !['arrow', 'group', 'frame'].includes(shape.type))
    .flatMap((shape) => {
      const described = describeShape(editor, shape)
      return described ? [described] : []
    })
  editor.run(() => {
    for (const id of ids) {
      const shape = editor.getShape(id)
      if (
        !shape ||
        !editor.isShapeOfType(shape, 'arrow') ||
        editor.isShapeOrAncestorLocked(shape)
      )
        continue
      if (!connectorObstacles(editor, shape, nodes).length) continue
      const original = { kind: shape.props.kind, bend: shape.props.bend }
      const bounds = editor.getShapePageBounds(shape)!
      const step = Math.max(64, Math.hypot(bounds.w, bounds.h) * 0.15)
      let routed = false
      for (const magnitude of [1, 2, 3, 4, 6, 8]) {
        for (const sign of [1, -1]) {
          editor.updateShape({
            id,
            type: 'arrow',
            props: { kind: 'arc', bend: sign * step * magnitude },
          })
          const arrow = editor.getShape(id)!
          if (
            editor.isShapeOfType(arrow, 'arrow') &&
            !connectorObstacles(editor, arrow, nodes).length
          ) {
            routed = true
            break
          }
        }
        if (routed) break
      }
      if (!routed) editor.updateShape({ id, type: 'arrow', props: original })
    }
  })
}

export function connectShapes(editor: Editor, input: ConnectShapesInput) {
  const newConnections = input.connections.filter(
    (connection) => !connection.arrowId,
  )
  const existing = input.connections.filter((connection) => connection.arrowId)
  for (const connection of input.connections) {
    if (
      connection.arrowId &&
      editable(editor, toShapeId(connection.arrowId)).type !== 'arrow'
    )
      throw new Error('arrowId must identify an existing arrow')
    for (const end of [connection.from, connection.to])
      if (typeof end === 'string' && !editor.getShape(toShapeId(end)))
        throw new Error(`Shape not found: ${end}`)
    if (
      typeof connection.from === 'string' &&
      connection.from === connection.to
    )
      throw new Error('An arrow cannot start and end on the same shape')
  }
  const result = newConnections.length
    ? createShapes(editor, {
        shapes: newConnections.map((connection) => ({
          type: 'arrow' as const,
          ...connection,
        })),
      })
    : { created: [], aliases: {} }
  const updated: string[] = []
  editor.run(() => {
    for (const connection of existing) {
      createArrow(
        editor,
        { type: 'arrow', ...connection },
        toShapeId(connection.arrowId!),
        toShapeId,
      )
      if (connection.kind !== undefined || connection.bend !== undefined)
        editor.updateShape({
          id: toShapeId(connection.arrowId!),
          type: 'arrow',
          meta: {
            ...editor.getShape(toShapeId(connection.arrowId!))!.meta,
            rhymeAutoRoute: false,
          },
        })
      updated.push(connection.arrowId!)
    }
  })
  const autoIds = [
    ...result.created.flatMap((shape, index) =>
      newConnections[index]?.kind === undefined &&
      newConnections[index]?.bend === undefined
        ? [toShapeId(shape.id)]
        : [],
    ),
    ...existing
      .filter(
        (connection) =>
          connection.kind === undefined &&
          connection.bend === undefined &&
          editor.getShape(toShapeId(connection.arrowId!))?.meta
            .rhymeAutoRoute === true,
      )
      .map((connection) => toShapeId(connection.arrowId!)),
  ]
  editor.run(() => {
    for (const id of autoIds)
      editor.updateShape({
        id,
        type: 'arrow',
        meta: { ...editor.getShape(id)!.meta, rhymeAutoRoute: true },
      })
    routeConnectors(editor, autoIds)
  })
  const created = descriptions(
    editor,
    result.created.map((shape) => toShapeId(shape.id)),
  )
  return {
    ...result,
    created,
    updated,
    connected: [...created, ...descriptions(editor, updated.map(toShapeId))],
  }
}

function topLevelShapes(editor: Editor, ids: string[]) {
  const selected = new Set(ids.map(toShapeId))
  return [...selected].filter((id) => {
    let shape = editable(editor, id)
    const seen = new Set<TLShapeId>()
    while (shape.parentId.startsWith('shape:')) {
      const parentId = shape.parentId as TLShapeId
      if (selected.has(parentId)) return false
      if (seen.has(parentId)) break
      seen.add(parentId)
      const parent = editor.getShape(parentId)
      if (!parent) break
      shape = parent
    }
    return true
  })
}

export async function arrangeShapes(editor: Editor, input: ArrangeShapesInput) {
  const ids = topLevelShapes(editor, input.ids).filter(
    (id) => editor.getShape(id)?.type !== 'arrow',
  )
  if (!ids.length)
    throw new Error(
      'No movable node shapes; select the nodes rather than their connectors',
    )
  const before = descriptions(editor, ids)
  const bounds = unionBounds(before)!
  const fingerprints = ids.map((id) =>
    JSON.stringify({
      shape: editor.getShape(id),
      transform: editor.getShapePageTransform(id),
    }),
  )
  if (input.operation === 'layout') {
    const selected = new Set(ids.map(toAgentId))
    const edges = editor
      .getCurrentPageShapesSorted()
      .filter((shape) => shape.type === 'arrow')
      .flatMap((shape) => {
        const described = describeShape(editor, shape)
        return described ? [described] : []
      })
      .filter(
        (shape) =>
          shape.from &&
          shape.to &&
          selected.has(shape.from) &&
          selected.has(shape.to),
      )
      .map((shape) => ({ from: shape.from!, to: shape.to!, text: shape.text }))
    const positions = await computeLayout(before, edges, input.layout)
    if (
      ids.some(
        (id, index) =>
          JSON.stringify({
            shape: editor.getShape(id),
            transform: editor.getShapePageTransform(id),
          }) !== fingerprints[index],
      )
    )
      throw new Error(
        'Shapes changed while layout was calculating; read the scene and retry',
      )
    for (const id of ids) editable(editor, id)
    const origin = input.origin ?? bounds
    editor.run(() => {
      for (const position of positions)
        moveShapeTo(
          editor,
          toShapeId(position.id),
          origin.x + position.x,
          origin.y + position.y,
        )
    })
  } else {
    editor.run(() => {
      if (input.operation === 'pack') editor.packShapes(ids, input.layout.gap)
      else if (input.operation.startsWith('align-'))
        editor.alignShapes(
          ids,
          input.operation.slice(6) as Parameters<Editor['alignShapes']>[1],
        )
      else
        editor.distributeShapes(
          ids,
          input.operation === 'distribute-horizontal'
            ? 'horizontal'
            : 'vertical',
        )
    })
  }
  const touched = new Set(
    [...editor.getShapeAndDescendantIds(ids)].map(toAgentId),
  )
  const autoArrows = editor
    .getCurrentPageShapesSorted()
    .filter((shape) => {
      if (shape.type !== 'arrow' || shape.meta.rhymeAutoRoute !== true)
        return false
      const described = describeShape(editor, shape)
      return (
        touched.has(described?.from ?? '') || touched.has(described?.to ?? '')
      )
    })
    .map((shape) => shape.id)
  routeConnectors(editor, autoArrows)
  return {
    updated: ids.map(toAgentId),
    shapes: descriptions(editor, ids),
    inspection: inspectScene(editor, {
      ids: ids.map(toAgentId),
      minGap: 24,
      maxIssues: 50,
    }),
  }
}

export async function createDiagram(editor: Editor, input: CreateDiagramInput) {
  ensureUniqueIds(input.nodes)
  ensureUniqueIds(input.edges)
  const nodeIds = new Set(input.nodes.map((node) => node.id))
  for (const edge of input.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to))
      throw new Error(
        'Diagram edges must reference nodes in this diagram; use connect_shapes for existing nodes',
      )
    if (edge.from === edge.to)
      throw new Error(
        'Self connections are unsupported; use a separate feedback node',
      )
    if (edge.id && nodeIds.has(edge.id))
      throw new Error('Node and edge ids must be distinct')
  }
  const nodes = input.nodes.map((node) => prepareDiagramNode(editor, node))
  const positions = await computeLayout(nodes, input.edges, input.layout)
  const placed = nodes.map((node) => ({
    ...node,
    ...positions.find((position) => position.id === node.id)!,
  }))
  const sceneBounds = unionBounds(placed)!
  const viewport = editor.getViewportPageBounds()
  const origin = input.origin ?? { x: viewport.x + 40, y: viewport.y + 40 }
  const obstacles = editor
    .getCurrentPageShapesSorted()
    .filter((shape) => shape.type !== 'arrow')
    .flatMap((shape) => {
      const bounds = editor.getShapePageBounds(shape)
      return bounds ? [bounds] : []
    })
  const point = input.avoidExisting
    ? findEmptyPosition(sceneBounds, origin, obstacles, input.layout.gap)
    : origin
  if (Math.abs(point.x) > 1e6 || Math.abs(point.y) > 1e6)
    throw new Error(
      'No space within supported canvas coordinates; choose an origin closer to the page center',
    )
  const shapes: NewShape[] = placed.map((node) => ({
    ...node,
    x: point.x + node.x,
    y: point.y + node.y,
  }))
  shapes.push(
    ...input.edges.map((edge) => ({
      type: 'arrow' as const,
      ...edge,
      kind:
        edge.kind ??
        (input.layout.mode === 'flow' ? ('elbow' as const) : ('arc' as const)),
      font: edge.font ?? 'sans',
      labelColor: edge.labelColor ?? ('black' as const),
    })),
  )
  const result = createShapes(editor, { shapes })
  const autoIds = result.created
    .filter((shape) => shape.type === 'arrow')
    .flatMap((shape, index) => {
      const edge = input.edges[index]
      return edge?.kind === undefined && edge?.bend === undefined
        ? [toShapeId(shape.id)]
        : []
    })
  editor.run(() => {
    for (const id of autoIds)
      editor.updateShape({
        id,
        type: 'arrow',
        meta: { ...editor.getShape(id)!.meta, rhymeAutoRoute: true },
      })
    routeConnectors(editor, autoIds)
  })
  result.created = descriptions(
    editor,
    result.created.map((shape) => toShapeId(shape.id)),
  )
  return {
    ...result,
    bounds: unionBounds(
      result.created.filter((shape) => shape.type !== 'arrow'),
    ),
    inspection: inspectScene(editor, {
      ids: result.created.map((shape) => shape.id),
      minGap: 24,
      maxIssues: 50,
    }),
  }
}

export function runCanvasTool(editor: Editor, name: string, input: unknown) {
  if (
    editor.getIsReadonly() &&
    name !== 'read_canvas' &&
    name !== 'inspect_scene'
  )
    throw new Error('Canvas is read-only')
  if (!isCanvasTool(name)) throw new Error(`Unknown tool "${name}"`)
  switch (name) {
    case 'read_canvas':
      return describeCanvas(editor, parseToolInput(name, input))
    case 'create_shapes':
      return createShapes(editor, parseToolInput(name, input))
    case 'update_shapes':
      return updateShapes(editor, parseToolInput(name, input))
    case 'delete_shapes':
      return deleteShapes(editor, parseToolInput(name, input))
    case 'arrange_shapes':
      return arrangeShapes(editor, parseToolInput(name, input))
    case 'connect_shapes':
      return connectShapes(editor, parseToolInput(name, input))
    case 'create_diagram':
      return createDiagram(editor, parseToolInput(name, input))
    case 'inspect_scene':
      return inspectScene(editor, parseToolInput(name, input))
  }
}
