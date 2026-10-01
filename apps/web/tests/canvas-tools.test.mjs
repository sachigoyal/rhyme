import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { useAgentChat } from '@cloudflare/ai-chat/react'

let server
let runCanvasTool
let createCanvasToolRunner
let getCanvasAgentOptions

before(async () => {
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ runCanvasTool } = await server.ssrLoadModule(
    '/src/features/agent/canvas-actions.ts',
  ))
  ;({ createCanvasToolRunner } = await server.ssrLoadModule(
    '/src/features/agent/canvas-tool-runner.ts',
  ))
  ;({ getCanvasAgentOptions } = await server.ssrLoadModule(
    '/src/features/agent/agent-connection.ts',
  ))
})

after(async () => server?.close())

test('new conversations hydrate independently and opening history restores only that conversation', async () => {
  const previousFetch = globalThis.fetch
  const fetched = []
  const oldMessage = {
    id: 'existing-message',
    role: 'user',
    parts: [{ type: 'text', text: 'Keep this only in the old conversation' }],
  }
  globalThis.fetch = async (url) => {
    fetched.push(String(url))
    return new Response(
      JSON.stringify(String(url).includes('history-chat') ? [oldMessage] : []),
      { headers: { 'content-type': 'application/json' } },
    )
  }
  function Transcript({ conversationId }) {
    const options = getCanvasAgentOptions(
      'canvas',
      conversationId,
      'https://rhyme.test',
    )
    const name = options.name ?? 'default'
    const agent = {
      agent: 'canvas-agent',
      name,
      path: [{ agent: options.agent, name }],
      getHttpUrl: () => `${options.host}/${options.basePath}`,
    }
    const chat = useAgentChat({ agent, credentials: 'include' })
    return createElement(
      'span',
      null,
      JSON.stringify(chat.messages.map((message) => message.id)),
    )
  }
  const render = async (conversationId) => {
    const stream = await renderToReadableStream(
      createElement(Transcript, { conversationId }),
    )
    await stream.allReady
    return new Response(stream).text()
  }
  try {
    assert.match(await render('history-chat'), /existing-message/)
    assert.equal(await render('fresh-chat'), '<span>[]</span>')
    assert.match(await render('history-chat'), /existing-message/)
    assert.equal(fetched.length, 2)
  } finally {
    globalThis.fetch = previousFetch
  }
})

function makeEditor() {
  const shapes = new Map()
  const bindings = []
  const offsets = new Map()
  let historyPoints = 0
  return {
    shapes,
    bindings,
    offsets,
    store: {
      createComputedCache(_name, derive) {
        return { get: (id) => derive(shapes.get(id)) }
      },
    },
    get historyPoints() {
      return historyPoints
    },
    markHistoryStoppingPoint() {
      historyPoints++
    },
    run(fn) {
      fn()
    },
    getShapeAndDescendantIds(ids) {
      return new Set(ids)
    },
    getIsReadonly() {
      return false
    },
    isShapeOrAncestorLocked(shapeOrId) {
      const shape =
        typeof shapeOrId === 'string' ? shapes.get(shapeOrId) : shapeOrId
      return Boolean(shape?.isLocked)
    },
    getShapeParentTransform(shape) {
      const offset = offsets.get(shape.id) ?? { x: 0, y: 0 }
      return {
        applyToPoint: (point) => ({
          x: point.x + offset.x,
          y: point.y + offset.y,
        }),
      }
    },
    getPointInParentSpace(shape, point) {
      const offset = offsets.get(shape.id) ?? { x: 0, y: 0 }
      return { x: point.x - offset.x, y: point.y - offset.y }
    },
    getShape(id) {
      return shapes.get(id)
    },
    getCurrentPageShapesSorted() {
      return [...shapes.values()]
    },
    getSelectedShapeIds() {
      return []
    },
    getViewportPageBounds() {
      return { x: 0, y: 0, w: 1200, h: 900, collides: () => true }
    },
    getTextOptions() {
      return {}
    },
    isShapeOfType(shape, type) {
      return shape.type === type
    },
    createShape(shape) {
      shapes.set(shape.id, {
        parentId: 'page:page',
        ...shape,
        props: { ...shape.props },
      })
    },
    createBinding(binding) {
      bindings.push(binding)
    },
    getBindingsFromShape(shape, type) {
      return bindings.filter(
        (binding) =>
          binding.fromId === (typeof shape === 'string' ? shape : shape.id) &&
          binding.type === type,
      )
    },
    updateShape(update) {
      const current = shapes.get(update.id)
      shapes.set(update.id, {
        ...current,
        ...update,
        props: { ...current.props, ...update.props },
      })
    },
    deleteShapes(ids) {
      ids.forEach((id) => shapes.delete(id))
    },
    getShapePageBounds(shapeOrId) {
      const shape =
        typeof shapeOrId === 'string' ? shapes.get(shapeOrId) : shapeOrId
      if (!shape) return undefined
      const offset = offsets.get(shape.id) ?? { x: 0, y: 0 }
      const bounds = {
        x: shape.x + offset.x,
        y: shape.y + offset.y,
        w: shape.props.w ?? 100,
        h: shape.props.h ?? 80,
      }
      return {
        ...bounds,
        center: { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
      }
    },
  }
}

const box = (id, x = 0) => ({ id, type: 'geo', x, y: 0, w: 100, h: 80 })

test('replayed tool calls return their original result without drawing twice', async () => {
  const editor = makeEditor()
  const runner = createCanvasToolRunner(editor)
  const first = await runner.run('call-1', 'create_shapes', {
    shapes: [box('idea')],
  })
  const replay = await runner.run('call-1', 'create_shapes', {
    shapes: [box('idea')],
  })
  assert.equal(first.applied, true)
  assert.equal(replay.applied, false)
  assert.strictEqual(replay.result, first.result)
  assert.equal(editor.shapes.size, 1)
  assert.equal(editor.historyPoints, 1)
  await runner.run('call-2', 'update_shapes', {
    updates: [{ id: 'idea', color: 'blue' }],
  })
  assert.equal(editor.historyPoints, 1)
  runner.beginTurn()
  await runner.run('call-3', 'update_shapes', {
    updates: [{ id: 'idea', x: 120 }],
  })
  assert.equal(editor.historyPoints, 2)
})

test('invalid external input cannot mutate the editor, including on replay', async () => {
  const editor = makeEditor()
  const runner = createCanvasToolRunner(editor)
  const result = await runner.run('bad-input', 'create_shapes', {
    shapes: [box('idea', Infinity)],
  })
  assert.equal(result.result.state, 'output-error')
  assert.equal(editor.shapes.size, 0)
  assert.strictEqual(
    (await runner.run('bad-input', 'create_shapes', { shapes: [box('idea')] }))
      .result,
    result.result,
  )
  assert.throws(() => runCanvasTool(editor, 'unknown_tool', {}), /Unknown tool/)
  assert.equal(editor.shapes.size, 0)
})

test('colliding model IDs preserve existing shapes and bind arrows to fresh aliases', async () => {
  const editor = makeEditor()
  runCanvasTool(editor, 'create_shapes', { shapes: [box('a', 900)] })
  const result = runCanvasTool(editor, 'create_shapes', {
    shapes: [
      box('a'),
      box('b', 200),
      { type: 'arrow', id: 'link', from: 'a', to: 'b' },
    ],
  })
  assert.equal(result.created.length, 3)
  assert.equal(editor.getShape('shape:a').x, 900)
  const aliasedA = result.created.find(
    (shape) => shape.type === 'geo' && shape.x === 0,
  )
  assert.notEqual(aliasedA.id, 'a')
  assert.equal(
    editor.bindings.find((binding) => binding.props.terminal === 'start').toId,
    `shape:${aliasedA.id}`,
  )
  assert.equal(
    editor.bindings.find((binding) => binding.props.terminal === 'end').toId,
    'shape:b',
  )
})

test('page-coordinate moves preserve the parent-relative positions of nested shapes', async () => {
  const editor = makeEditor()
  editor.createShape({
    ...box('shape:nested'),
    x: 10,
    y: 20,
    props: { w: 100, h: 80, color: 'black' },
  })
  editor.offsets.set('shape:nested', { x: 100, y: 200 })
  const result = runCanvasTool(editor, 'update_shapes', {
    updates: [
      { id: 'nested', x: 150, y: 260 },
      { id: 'missing', x: 500 },
    ],
  })
  assert.equal(editor.getShape('shape:nested').x, 50)
  assert.equal(editor.getShape('shape:nested').y, 60)
  assert.deepEqual(result.updated, ['nested'])
  assert.equal(result.errors[0].id, 'missing')
})

test('declined deletions stay declined on replay and approved deletion reports missing IDs', async () => {
  const editor = makeEditor()
  const runner = createCanvasToolRunner(editor)
  await runner.run('create', 'create_shapes', { shapes: [box('keep')] })
  const denied = runner.reject(
    'delete-denied',
    'The user declined this deletion.',
  )
  assert.strictEqual(
    (await runner.run('delete-denied', 'delete_shapes', { ids: ['keep'] }))
      .result,
    denied,
  )
  assert.equal(editor.shapes.size, 1)
  const result = await runner.run('delete-approved', 'delete_shapes', {
    ids: ['keep', 'missing'],
  })
  assert.deepEqual(result.result.output, {
    deleted: ['keep'],
    missing: ['missing'],
  })
  assert.equal(editor.shapes.size, 0)
  assert.equal(
    (await runner.run('delete-approved', 'delete_shapes', { ids: ['keep'] }))
      .applied,
    false,
  )
})

test('recoverable failures are sent as tool results so the model can continue without retrying declined deletions', async () => {
  const { continuingToolResult } = await server.ssrLoadModule(
    '/src/features/agent/canvas-tool-runner.ts',
  )
  assert.deepEqual(
    continuingToolResult({
      state: 'output-error',
      errorText: 'Deletion declined',
    }),
    {
      state: 'output-available',
      output: { ok: false, error: 'Deletion declined' },
    },
  )
})
