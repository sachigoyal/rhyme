import { JSONParser } from '@streamparser/json'
import type { Editor } from 'tldraw'
import { canvasToolInputs } from 'api/canvas-schema'
import type { NewShape } from 'api/canvas-schema'
import {
  createDiagram,
  createShapes,
  connectShapes,
  parseToolInput,
  updateShapes,
} from './canvas-actions'
import type { runCanvasTool } from './canvas-actions'
import { describeShape, toShapeId, toAgentId } from './canvas-context'
import { prepareDiagramNode } from './canvas-layout'
import { beginEditorBatch } from '../editor/editor-batch'

const supported = new Set([
  'create_shapes',
  'update_shapes',
  'connect_shapes',
  'create_diagram',
])
type Entry = {
  field: string
  index: number
  value: unknown
  done: boolean
  created?: string[]
}
function normalize(field: string, value: unknown): unknown {
  switch (field) {
    case 'shapes':
      return parseToolInput('create_shapes', { shapes: [value] }).shapes[0]
    case 'updates':
      return parseToolInput('update_shapes', { updates: [value] }).updates?.[0]
    case 'connections':
    case 'edges':
      return parseToolInput('connect_shapes', { connections: [value] })
        .connections[0]
    case 'nodes':
      return parseToolInput('create_diagram', { nodes: [value] }).nodes[0]
    case 'shared':
      return parseToolInput('update_shapes', value)
    default:
      return value
  }
}
type Stream = {
  id: string
  name: string
  parser: JSONParser
  entries: Map<string, Entry>
  aliases: Record<string, string>
  created: string[]
  updated: string[]
  errors: Array<{ index: number; error: string }>
  shared: Record<string, unknown>
  release: () => void
  origin: { x: number; y: number }
  nextY: number
  bytes: number
  stopped: boolean
  ready: boolean
  closed: Set<string>
}

export function createCanvasStreamExecutor(
  editor: Editor,
  schedule: (action: () => Promise<void>) => void,
  markTurn: () => void,
) {
  const streams = new Map<string, Stream>()
  const settled = new Set<string>()
  const findCreated = (stream: Stream, operation: string) =>
    editor.getCurrentPageShapesSorted().find((item) => {
      const creation = item.meta?.rhymeAgentCreation as
        | { call?: string; operation?: string }
        | undefined
      return creation?.call === stream.id && creation.operation === operation
    })
  const recordCreated = (stream: Stream, ids: string[], operation: string) => {
    for (const id of ids) {
      const record = editor.getShape(toShapeId(id))!
      editor.updateShape({
        id: record.id,
        type: record.type,
        meta: {
          ...record.meta,
          rhymeAgentCreation: { call: stream.id, operation },
        },
      })
    }
  }
  const completed = (stream: Stream, id: string, operation: string) => {
    const operations = editor.getShape(toShapeId(id))?.meta
      .rhymeAgentOperations as Record<string, unknown> | undefined
    const entries = operations?.[stream.id]
    return Array.isArray(entries) && entries.includes(operation)
  }
  const recordUpdates = (stream: Stream, ids: string[], operation: string) => {
    editor.run(() => {
      for (const id of ids) {
        const shape = editor.getShape(toShapeId(id))
        if (!shape) continue
        const previous = shape.meta?.rhymeAgentOperations as
          | Record<string, string[]>
          | undefined
        const entries = previous?.[stream.id]
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          meta: {
            ...shape.meta,
            rhymeAgentOperations: {
              ...Object.fromEntries(Object.entries(previous ?? {}).slice(-15)),
              [stream.id]: [
                ...(Array.isArray(entries) ? entries : []),
                operation,
              ],
            },
          },
        })
      }
    })
  }

  const apply = async (stream: Stream, entry: Entry) => {
    if (stream.stopped || entry.done || editor.isDisposed) return
    if (editor.getIsReadonly()) throw new Error('Canvas is read-only')
    const { field, index, value } = entry
    const operation = `${field}:${index}`
    let shape: NewShape | undefined
    if (field === 'shapes') {
      shape = parseToolInput('create_shapes', { shapes: [value] }).shapes[0]!
    } else if (field === 'nodes') {
      const node = parseToolInput('create_diagram', { nodes: [value] })
        .nodes[0]!
      shape = {
        ...prepareDiagramNode(editor, node),
        x: stream.origin.x,
        y: stream.nextY,
      }
    } else if (field === 'edges') {
      const parsed = canvasToolInputs.connect_shapes.safeParse({
        connections: [value],
      })
      if (!parsed.success) return
      shape = {
        ...parsed.data.connections[0]!,
        type: 'arrow',
        kind: parsed.data.connections[0]!.kind ?? 'elbow',
        font: parsed.data.connections[0]!.font ?? 'sans',
        labelColor: parsed.data.connections[0]!.labelColor ?? 'black',
      }
    }
    if (shape) {
      const existing = findCreated(stream, operation)
      if (existing) {
        const id = toAgentId(existing.id)
        if (shape.id) stream.aliases[shape.id] = id
        stream.created.push(id)
        entry.created = [id]
        entry.done = true
        if (field === 'nodes') {
          const bounds = editor.getShapePageBounds(existing)
          if (bounds) stream.nextY = Math.max(stream.nextY, bounds.maxY + 64)
        }
        return
      }
      if (shape.id && Object.hasOwn(stream.aliases, shape.id))
        throw new Error(`Duplicate shape id "${shape.id}"`)
      if (shape.type === 'arrow') {
        if (
          [shape.from, shape.to].some(
            (end) =>
              typeof end === 'string' &&
              !stream.aliases[end] &&
              (field === 'edges' ||
                (field === 'shapes' && !stream.closed.has('shapes'))),
          )
        )
          return
        shape = {
          ...shape,
          from:
            typeof shape.from === 'string'
              ? (stream.aliases[shape.from] ?? shape.from)
              : shape.from,
          to:
            typeof shape.to === 'string'
              ? (stream.aliases[shape.to] ?? shape.to)
              : shape.to,
        }
        if (
          [shape.from, shape.to].some(
            (end) =>
              typeof end === 'string' && !editor.getShape(toShapeId(end)),
          )
        )
          return
      }
      markTurn()
      const result = createShapes(editor, { shapes: [shape] })
      Object.assign(stream.aliases, result.aliases)
      stream.created.push(...result.created.map((item) => item.id))
      entry.created = result.created.map((item) => item.id)
      recordCreated(stream, entry.created, operation)
      stream.errors.push(
        ...(result.errors ?? []).map((error) => ({ ...error, index })),
      )
      if (field === 'nodes')
        stream.nextY += (('h' in shape ? shape.h : 200) ?? 200) + 64
    } else if (field === 'updates' || field === 'shared') {
      const input = parseToolInput(
        'update_shapes',
        field === 'shared' ? value : { updates: [value] },
      )
      const ids = [
        ...(input.ids ?? []),
        ...(input.updates?.map((update) => update.id) ?? []),
      ]
      const prior = ids.filter((id) => completed(stream, id, operation))
      stream.updated.push(...prior)
      input.ids = input.ids?.filter((id) => !completed(stream, id, operation))
      input.updates = input.updates?.filter(
        (update) => !completed(stream, update.id, operation),
      )
      markTurn()
      const result = updateShapes(editor, input)
      stream.updated.push(...result.updated)
      recordUpdates(stream, result.updated, operation)
      stream.errors.push(
        ...(result.errors ?? []).map((error) => ({
          index,
          error: error.error,
        })),
      )
    } else if (field === 'connections') {
      const input = parseToolInput('connect_shapes', { connections: [value] })
      const connection = input.connections[0]!
      const existing = findCreated(stream, operation)
      if (existing) {
        const id = toAgentId(existing.id)
        if (connection.id) stream.aliases[connection.id] = id
        stream.created.push(id)
        entry.created = [id]
        entry.done = true
        return
      }
      if (
        connection.arrowId &&
        completed(stream, connection.arrowId, operation)
      ) {
        stream.updated.push(connection.arrowId)
        entry.done = true
        return
      }
      if (
        [connection.from, connection.to].some(
          (end) => typeof end === 'string' && !editor.getShape(toShapeId(end)),
        )
      )
        return
      markTurn()
      const result = await connectShapes(editor, input)
      Object.assign(stream.aliases, result.aliases)
      stream.created.push(...result.created.map((item) => item.id))
      stream.updated.push(...result.updated)
      entry.created = result.created.map((item) => item.id)
      recordCreated(stream, entry.created, operation)
      recordUpdates(stream, result.updated, operation)
      stream.errors.push(
        ...(result.errors ?? []).map((error) => ({ ...error, index })),
      )
    } else return
    entry.done = true
  }

  const drain = async (stream: Stream) => {
    for (const entry of stream.entries.values()) {
      try {
        await apply(stream, entry)
      } catch (error) {
        entry.done = true
        stream.errors.push({
          index: entry.index,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  const accept = (
    stream: Stream,
    field: string,
    index: number,
    value: unknown,
  ) => {
    const key = `${field}:${index}`
    const previous = stream.entries.get(key)
    if (previous) {
      if (JSON.stringify(previous.value) !== JSON.stringify(value))
        throw new Error('A streamed instruction changed after it was received')
      return
    }
    if (index >= (field === 'edges' ? 400 : 200))
      throw new Error('Too many streamed instructions')
    stream.entries.set(key, { field, index, value, done: false })
    schedule(() => drain(stream))
  }

  return {
    start(id: string, name: string) {
      if (!supported.has(name) || settled.has(id)) return
      const existing = streams.get(id)
      const viewport = editor.getViewportPageBounds()
      const origin = { x: viewport.x + 40, y: viewport.y + 40 }
      const stream: Stream = existing ?? {
        name,
        id,
        parser: new JSONParser(),
        entries: new Map(),
        aliases: {},
        created: [],
        updated: [],
        errors: [],
        shared: {},
        release: beginEditorBatch(editor),
        origin,
        nextY: origin.y,
        bytes: 0,
        stopped: false,
        ready: false,
        closed: new Set(),
      }
      if (stream.stopped) return
      stream.bytes = 0
      stream.parser = new JSONParser({
        paths: [
          '$.shapes.*',
          '$.shapes',
          '$.updates.*',
          '$.connections.*',
          '$.nodes.*',
          '$.edges.*',
          '$.ids',
          '$.patch',
        ],
      })
      stream.parser.onValue = ({ key, stack, value }) => {
        const field = stack.at(-1)?.key
        if (typeof field === 'string' && typeof key === 'number') {
          const allowed = {
            create_shapes: ['shapes'],
            update_shapes: ['updates'],
            connect_shapes: ['connections'],
            create_diagram: ['nodes', 'edges'],
          }[name]
          if (allowed?.includes(field)) accept(stream, field, key, value)
        } else if (name === 'create_shapes' && key === 'shapes') {
          stream.closed.add('shapes')
          schedule(() => drain(stream))
        } else if (
          name === 'update_shapes' &&
          (key === 'ids' || key === 'patch')
        ) {
          stream.shared[key] = value
          if (stream.shared.ids && stream.shared.patch)
            accept(stream, 'shared', 0, { ...stream.shared })
        }
      }
      streams.set(id, stream)
    },
    append(id: string, delta: string) {
      const stream = streams.get(id)
      if (!stream || stream.stopped || settled.has(id)) return
      if (stream.errors.some((error) => error.index === -1)) return
      try {
        stream.bytes += delta.length
        if (stream.bytes > 8 * 1024 * 1024)
          throw new Error('Streamed tool input is too large')
        stream.parser.write(delta)
      } catch (error) {
        stream.errors.push({
          index: -1,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    ready(id: string) {
      const stream = streams.get(id)
      if (stream) stream.ready = true
    },
    interrupt(id?: string) {
      for (const [callId, stream] of streams) {
        if (id ? callId !== id : stream.ready) continue
        stream.stopped = true
        settled.add(callId)
        stream.release()
      }
    },
    cancel() {
      for (const [id, stream] of streams) {
        stream.stopped = true
        settled.add(id)
        stream.release()
      }
    },
    async finish(
      id: string,
      name: string,
      input: unknown,
    ): Promise<Awaited<ReturnType<typeof runCanvasTool>> | undefined> {
      let stream = streams.get(id)
      if (
        !stream &&
        supported.has(name) &&
        editor.getCurrentPageShapesSorted().some((shape) => {
          const creation = shape.meta?.rhymeAgentCreation as
            | { call?: string }
            | undefined
          const operations = shape.meta?.rhymeAgentOperations as
            | Record<string, unknown>
            | undefined
          return creation?.call === id || Array.isArray(operations?.[id])
        })
      ) {
        this.start(id, name)
        stream = streams.get(id)
      }
      if (!stream) return undefined
      settled.add(id)
      try {
        if (!stream.stopped) {
          const parsed = parseToolInput(
            name as keyof typeof canvasToolInputs,
            input,
          ) as Record<string, unknown>
          stream.closed.add('shapes')
          for (const entry of stream.entries.values()) {
            const values = parsed[entry.field]
            const finalValue =
              entry.field === 'shared'
                ? { ids: parsed.ids, patch: parsed.patch }
                : Array.isArray(values)
                  ? values[entry.index]
                  : undefined
            if (
              finalValue === undefined ||
              JSON.stringify(normalize(entry.field, entry.value)) !==
                JSON.stringify(normalize(entry.field, finalValue))
            ) {
              throw new Error(
                'Final tool input does not match the instructions already received; completed edits were retained',
              )
            }
          }
          for (const field of [
            'shapes',
            'updates',
            'connections',
            'nodes',
            'edges',
          ]) {
            const values = parsed[field]
            if (Array.isArray(values))
              for (const [index, value] of values.entries()) {
                const key = `${field}:${index}`
                if (!stream.entries.has(key))
                  stream.entries.set(key, { field, index, value, done: false })
              }
          }
          if (
            name === 'update_shapes' &&
            parsed.ids &&
            parsed.patch &&
            !stream.entries.has('shared:0')
          ) {
            stream.entries.set('shared:0', {
              field: 'shared',
              index: 0,
              value: { ids: parsed.ids, patch: parsed.patch },
              done: false,
            })
          }
          await drain(stream)
          for (const entry of stream.entries.values()) {
            if (!entry.done)
              stream.errors.push({
                index: entry.index,
                error: 'Referenced shapes were not available',
              })
          }
          if (name === 'create_diagram' && !stream.errors.length) {
            return await createDiagram(
              editor,
              parseToolInput('create_diagram', input),
              undefined,
              {
                created: [...stream.entries.values()]
                  .filter((entry) => ['nodes', 'edges'].includes(entry.field))
                  .sort((a, b) =>
                    a.field === b.field
                      ? a.index - b.index
                      : a.field === 'nodes'
                        ? -1
                        : 1,
                  )
                  .flatMap((entry) => entry.created ?? []),
                aliases: stream.aliases,
              },
            )
          }
        }
      } catch (error) {
        stream.errors.push({
          index: -1,
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        stream.release()
        streams.delete(id)
      }
      const created = stream.created.flatMap((shapeId) => {
        const shape = editor.getShape(toShapeId(shapeId))
        const description = shape && describeShape(editor, shape)
        return description ? [description] : []
      })
      const result = {
        created,
        aliases: stream.aliases,
        updated: stream.updated,
        connected: created,
        shapes: stream.updated.flatMap((shapeId) => {
          const shape = editor.getShape(toShapeId(shapeId))
          const description = shape && describeShape(editor, shape)
          return description ? [description] : []
        }),
        ...(stream.stopped ? { interrupted: true } : {}),
        ...(stream.errors.length ? { errors: stream.errors } : {}),
      }
      return result
    },
  }
}
