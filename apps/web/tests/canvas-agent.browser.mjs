import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'

let server, browser, page, origin
const errors = []
before(async () => {
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    cacheDir: 'node_modules/.vite-canvas-tests',
    appType: 'custom',
    plugins: [
      react(),
      {
        name: 'canvas-agent-fixture',
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (request.url !== '/') return next()
            response.setHeader('Content-Type', 'text/html')
            response.end(
              await vite.transformIndexHtml(
                '/',
                '<html><head></head><body><div id="root"></div><script type="module" src="/tests/fixtures/canvas-agent.tsx"></script></body></html>',
              ),
            )
          })
        },
      },
    ],
    optimizeDeps: { entries: ['tests/fixtures/canvas-agent.tsx'] },
    server: { port: 0, host: '127.0.0.1', hmr: false, ws: false },
  })
  await server.listen()
  origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  })
})
beforeEach(async () => {
  await page?.close()
  errors.length = 0
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin)
  await page.waitForFunction(() => Boolean(window.canvasFixture))
  await page.evaluate(() => document.fonts.ready)
})
after(async () => {
  await browser?.close()
  await server?.close()
})
const run = (name, input) =>
  page.evaluate(({ name, input }) => window.canvasFixture.run(name, input), {
    name,
    input,
  })
const node = (id, role = 'process', text = id) => ({ id, role, text })
const box = (id, x = 0, y = 0) => ({ id, type: 'geo', x, y, w: 160, h: 100 })

const startTool = (id, name, request = 'turn') =>
  page.evaluate(
    ({ id, name, request }) => {
      window.canvasFixture.runner.receive(
        JSON.stringify({
          type: 'cf_agent_use_chat_response',
          id: request,
          body: JSON.stringify({
            type: 'tool-input-start',
            toolCallId: id,
            toolName: name,
          }),
          done: false,
        }),
      )
    },
    { id, name, request },
  )
const delta = async (id, text, request = 'turn') => {
  await page.evaluate(
    ({ id, text, request }) =>
      window.canvasFixture.runner.receive(
        JSON.stringify({
          type: 'cf_agent_use_chat_response',
          id: request,
          body: JSON.stringify({
            type: 'tool-input-delta',
            toolCallId: id,
            inputTextDelta: text,
          }),
          done: false,
        }),
      ),
    { id, text, request },
  )
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))
}
const finishTool = (id, name, input) =>
  page.evaluate(
    async ({ id, name, input }) => {
      const fixture = window.canvasFixture
      fixture.runner.receive(
        JSON.stringify({
          type: 'cf_agent_use_chat_response',
          id: 'turn',
          body: JSON.stringify({
            type: 'tool-input-available',
            toolCallId: id,
            toolName: name,
            input,
          }),
          done: false,
        }),
      )
      const result = await fixture.runner.run(id, name, input)
      await new Promise((resolve) => setTimeout(resolve, 50))
      await fixture.sync.flush()
      return result
    },
    { id, name, input },
  )

test('raw argument chunks execute completed shapes before JSON ends, without recreation or replay', async () => {
  const shapes = [box('first', 80, 100), box('second', 300, 100)]
  await startTool('build', 'create_shapes')
  await delta('build', '{"shapes":[' + JSON.stringify(shapes[0]).slice(0, -1))
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    0,
  )
  await delta('build', '},' + JSON.stringify(shapes[1]).slice(0, -1))
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    1,
  )
  await page.evaluate(() => {
    window.canvasFixture.firstRecord =
      window.canvasFixture.editor.getShape('shape:first')
  })
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 0)
  if (process.env.CANVAS_SCREENSHOT_DIR) {
    await mkdir(process.env.CANVAS_SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({
      path: process.env.CANVAS_SCREENSHOT_DIR + '/real-stream-creation.png',
    })
  }
  await delta('build', '}]}')
  await startTool('build', 'create_shapes')
  await delta('build', JSON.stringify({ shapes }))
  const result = await finishTool('build', 'create_shapes', { shapes })
  assert.equal(result.result.output.created.length, 2)
  assert.equal(
    await page.evaluate(
      () =>
        window.canvasFixture.firstRecord ===
        window.canvasFixture.editor.getShape('shape:first'),
    ),
    true,
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  await page.evaluate(() => window.canvasFixture.editor.undo())
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    0,
  )
  assert.deepEqual(errors, [])
})

test('streamed updates execute once when each object closes, including escaped JSON and relative moves', async () => {
  await run('create_shapes', { shapes: [box('existing', 80, 100)] })
  const updates = [
    {
      id: 'existing',
      dx: 30,
      color: 'red',
      text: 'Quoted "text" with } and 雨',
    },
    { id: 'existing', dy: 20 },
  ]
  await startTool('edit', 'update_shapes')
  await delta('edit', '{"updates":[' + JSON.stringify(updates[0]).slice(0, -1))
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getShape('shape:existing').x,
    ),
    80,
  )
  await delta('edit', '},' + JSON.stringify(updates[1]).slice(0, -1))
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getShape('shape:existing').x,
    ),
    110,
  )
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getShape('shape:existing').y,
    ),
    100,
  )
  if (process.env.CANVAS_SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.CANVAS_SCREENSHOT_DIR + '/real-stream-update.png',
    })
  await delta('edit', '}]}')
  await startTool('edit', 'update_shapes')
  await delta('edit', JSON.stringify({ updates }))
  const result = await finishTool('edit', 'update_shapes', { updates })
  assert.equal(result.result.output.updated.length, 2)
  assert.deepEqual(
    await page.evaluate(() => {
      const shape = window.canvasFixture.editor.getShape('shape:existing')
      return { x: shape.x, y: shape.y, color: shape.props.color }
    }),
    { x: 110, y: 120, color: 'red' },
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  assert.deepEqual(errors, [])
})

test('stopping the raw stream retains completed edits, saves once, and ignores late chunks', async () => {
  const shapes = [box('kept', 80, 100), box('not-created', 300, 100)]
  await startTool('cancel-build', 'create_shapes')
  await delta(
    'cancel-build',
    '{"shapes":[' +
      JSON.stringify(shapes[0]) +
      ',' +
      JSON.stringify(shapes[1]).slice(0, -1),
  )
  await page.evaluate(() => window.canvasFixture.runner.cancel())
  await delta('cancel-build', '}]}')
  const result = await finishTool('cancel-build', 'create_shapes', { shapes })
  assert.equal(result.result.output.interrupted, true)
  assert.equal(result.result.output.created.length, 1)
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    1,
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  await page.evaluate(() => window.canvasFixture.editor.undo())
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    0,
  )
  assert.deepEqual(errors, [])
})

test('forward connectors wait for nodes and collisions preserve the actual streamed identities', async () => {
  await run('create_shapes', { shapes: [box('a', 600, 100)] })
  const shapes = [
    { type: 'arrow', id: 'edge', from: 'a', to: 'b' },
    box('a', 80, 100),
    box('b', 300, 100),
  ]
  await startTool('bound', 'create_shapes')
  await delta('bound', '{"shapes":[' + JSON.stringify(shapes[0]) + ',')
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    1,
  )
  await delta(
    'bound',
    JSON.stringify(shapes[1]) + ',' + JSON.stringify(shapes[2]),
  )
  await page.waitForFunction(
    () => window.canvasFixture.editor.getCurrentPageShapeIds().size === 4,
  )
  const ids = await page.evaluate(() =>
    [...window.canvasFixture.editor.getCurrentPageShapeIds()].sort(),
  )
  await delta('bound', ']}')
  const result = await finishTool('bound', 'create_shapes', { shapes })
  assert.notEqual(result.result.output.aliases.a, 'a')
  assert.deepEqual(
    await page.evaluate(() =>
      [...window.canvasFixture.editor.getCurrentPageShapeIds()].sort(),
    ),
    ids,
  )
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getShape('shape:a').x,
    ),
    600,
  )
  const edge = result.result.output.created.find(
    (shape) => shape.type === 'arrow',
  )
  assert.equal(edge.from, result.result.output.aliases.a)
  assert.equal(edge.to, 'b')
  assert.deepEqual(errors, [])
})

test('streamed diagram nodes are real shapes and final layout moves those same records instead of recreating them', async () => {
  const input = {
    nodes: [
      node('node-a', 'start', 'First'),
      node('node-b', 'decision', 'Next?'),
    ],
    edges: [{ from: 'node-a', to: 'node-b' }],
    layout: { mode: 'flow', direction: 'right' },
  }
  await startTool('diagram', 'create_diagram')
  await delta('diagram', '{"nodes":[' + JSON.stringify(input.nodes[0]) + ',')
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    1,
  )
  await delta(
    'diagram',
    JSON.stringify(input.nodes[1]) +
      '],"edges":[' +
      JSON.stringify(input.edges[0]) +
      '],',
  )
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    3,
  )
  const ids = await page.evaluate(() =>
    [...window.canvasFixture.editor.getCurrentPageShapeIds()].sort(),
  )
  await delta('diagram', '"layout":' + JSON.stringify(input.layout) + '}')
  const result = await finishTool('diagram', 'create_diagram', input)
  assert.equal(result.result.output.created.length, 3)
  assert.deepEqual(
    await page.evaluate(() =>
      [...window.canvasFixture.editor.getCurrentPageShapeIds()].sort(),
    ),
    ids,
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  const nodes = result.result.output.created.filter(
    (shape) => shape.type !== 'arrow',
  )
  assert.ok(nodes[1].x > nodes[0].x)
  assert.deepEqual(errors, [])
})

test('a new runner resumes completed instructions from document metadata without duplicating shapes or relative moves', async () => {
  const shapes = [box('resumed', 80, 100), box('next', 300, 100)]
  await startTool('resume-create', 'create_shapes')
  await delta('resume-create', '{"shapes":[' + JSON.stringify(shapes[0]) + ',')
  await page.evaluate(() => {
    const fixture = window.canvasFixture
    fixture.runner = fixture.resetRunner()
  })
  const creation = await finishTool('resume-create', 'create_shapes', {
    shapes,
  })
  assert.equal(creation.result.output.created.length, 2)
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    2,
  )
  const updates = [
    { id: 'resumed', dx: 30 },
    { id: 'resumed', dy: 20 },
  ]
  await startTool('resume-update', 'update_shapes', 'next-turn')
  await delta(
    'resume-update',
    '{"updates":[' + JSON.stringify(updates[0]) + ',',
    'next-turn',
  )
  await page.evaluate(() => {
    const fixture = window.canvasFixture
    fixture.runner = fixture.resetRunner()
  })
  await finishTool('resume-update', 'update_shapes', { updates })
  assert.deepEqual(
    await page.evaluate(() => {
      const shape = window.canvasFixture.editor.getShape('shape:resumed')
      return [shape.x, shape.y]
    }),
    [110, 120],
  )
  assert.deepEqual(errors, [])
})

test('shared patch execution waits for the complete patch, regardless of JSON field order', async () => {
  await run('create_shapes', {
    shapes: [box('a', 80, 100), box('b', 300, 100)],
  })
  await startTool('shared', 'update_shapes')
  await delta('shared', '{"ids":["a","b"],"patch":{"dx":3')
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getShape('shape:a').x,
    ),
    80,
  )
  await delta('shared', '0}}')
  const input = { ids: ['a', 'b'], patch: { dx: 30 } }
  await finishTool('shared', 'update_shapes', input)
  assert.deepEqual(
    await page.evaluate(() =>
      ['shape:a', 'shape:b'].map(
        (id) => window.canvasFixture.editor.getShape(id).x,
      ),
    ),
    [110, 330],
  )
  assert.deepEqual(errors, [])
})

test('leaving during a stream saves completed instructions and not an unfinished object', async () => {
  await startTool('exit', 'create_shapes')
  await delta(
    'exit',
    '{"shapes":[' +
      JSON.stringify(box('saved', 80, 100)) +
      ',{"id":"incomplete"',
  )
  await page.evaluate(async () => {
    const fixture = window.canvasFixture
    fixture.runner.cancel()
    fixture.detach()
    await fixture.sync.flush()
  })
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  assert.equal(
    await page.evaluate(
      () =>
        Object.values(window.canvasFixture.saves[0].document.store).filter(
          (record) => record.typeName === 'shape',
        ).length,
    ),
    1,
  )
  assert.deepEqual(errors, [])
})

test('branching diagrams use semantic shapes, readable labels, measured sizes and safe spacing', async () => {
  const result = await run('create_diagram', {
    nodes: [
      node('start', 'start', 'Customer request'),
      node('gateway', 'service', 'API gateway'),
      node('auth', 'decision', 'Authorized?'),
      node('db', 'data', 'Store account'),
      node('email', 'external', 'Email provider'),
      node('end', 'end', 'Request complete'),
      node(
        'note',
        'annotation',
        'Optional retries are shown with dashed relationships',
      ),
    ],
    edges: [
      { from: 'start', to: 'gateway' },
      { from: 'gateway', to: 'auth' },
      { from: 'auth', to: 'db', text: 'yes' },
      { from: 'auth', to: 'end', text: 'no' },
      { from: 'db', to: 'email', text: 'send confirmation' },
      { from: 'email', to: 'end' },
    ],
  })
  assert.equal(result.created.length, 13)
  assert.equal(result.created.find((s) => s.id === 'auth').geo, 'diamond')
  assert.equal(result.created.find((s) => s.id === 'gateway').geo, 'hexagon')
  assert.equal(result.created.find((s) => s.id === 'email').geo, 'cloud')
  assert.equal(result.created.find((s) => s.id === 'note').type, 'text')
  assert.equal(result.inspection.totalIssues, 0)
  assert.ok(
    result.created
      .filter((s) => s.type === 'arrow')
      .every((s) => s.from && s.to && ['elbow', 'arc'].includes(s.kind)),
  )
  const context = await page.evaluate(() => window.canvasFixture.context())
  assert.match(context.screenshot, /^data:image\/jpeg;base64,/)
  assert.deepEqual(errors, [])
  if (process.env.CANVAS_SCREENSHOT_DIR) {
    await mkdir(process.env.CANVAS_SCREENSHOT_DIR, { recursive: true })
    await page.evaluate(() => {
      window.canvasFixture.editor.zoomToFit()
    })
    await page.screenshot({
      path: `${process.env.CANVAS_SCREENSHOT_DIR}/complex-scene.png`,
    })
  }
})

test('cycles, disconnected components and long multilingual labels stay separated', async () => {
  const result = await run('create_diagram', {
    nodes: [
      node(
        'a',
        'decision',
        'Should we retry this operation after a transient network failure?',
      ),
      node('b', 'service', 'পেমেন্ট যাচাই এবং পুনরায় চেষ্টা'),
      node('c', 'process', 'Execute'),
      node('separate', 'idea', 'An independent idea'),
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a', text: 'retry' },
    ],
    layout: { direction: 'down' },
  })
  assert.equal(result.inspection.totalIssues, 0)
  assert.ok(result.created.find((s) => s.id === 'a').h > 100)
  assert.deepEqual(errors, [])
})

test('80-note grid and one shared style patch preserve spacing and return geometry', async () => {
  const ids = Array.from({ length: 80 }, (_, i) => `note-${i}`)
  const scene = await run('create_diagram', {
    nodes: ids.map((id) => node(id, 'idea')),
    layout: { mode: 'grid', columns: 4 },
  })
  assert.equal(scene.inspection.totalIssues, 0)
  const styled = await run('update_shapes', {
    ids,
    patch: { color: 'blue', labelColor: 'black', font: 'sans' },
  })
  assert.equal(styled.updated.length, 80)
  assert.ok(styled.shapes.every((s) => s.color === 'blue'))
  const arranged = await run('arrange_shapes', {
    ids,
    layout: { mode: 'grid', columns: 8, gap: 80 },
  })
  assert.equal(arranged.inspection.totalIssues, 0)
  assert.equal(new Set(arranged.shapes.map((s) => s.x)).size, 8)
  assert.deepEqual(errors, [])
})

test('new diagrams avoid existing content and colliding aliases connect to new nodes', async () => {
  await run('create_shapes', { shapes: [box('a', 40, 40)] })
  const result = await run('create_diagram', {
    nodes: [node('a'), node('b')],
    edges: [{ from: 'a', to: 'b' }],
    origin: { x: 40, y: 40 },
  })
  assert.notEqual(result.aliases.a, 'a')
  const arrow = result.created.find((s) => s.type === 'arrow')
  assert.equal(arrow.from, result.aliases.a)
  assert.equal(result.inspection.totalIssues, 0)
  assert.equal((await run('read_canvas', { ids: ['a'] })).shapes[0].x, 40)
})

test('page reads paginate beyond 300, selection is retained, filters preserve full labels', async () => {
  const longLabel = 'Keep the complete important label. '.repeat(60)
  await page.evaluate((label) => {
    const { editor } = window.canvasFixture
    editor.createShapes(
      Array.from({ length: 1100 }, (_, i) => ({
        id: `shape:item-${i}`,
        type: 'geo',
        x: i * 200,
        y: 0,
        props: { w: 100, h: 80 },
      })),
    )
    editor.updateShape({
      id: 'shape:item-1099',
      type: 'geo',
      props: {
        richText: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: label }] },
          ],
        },
      },
    })
    editor.select('shape:item-1099')
  }, longLabel)
  const visible = await run('read_canvas', {})
  assert.ok(visible.shapes.some((s) => s.id === 'item-1099'))
  assert.equal(visible.total, 1100)
  assert.ok(visible.clusters.length <= 32)
  const first = await run('read_canvas', { scope: 'page', limit: 1000 })
  const second = await run('read_canvas', {
    scope: 'page',
    limit: 1000,
    offset: first.nextOffset,
  })
  assert.equal(
    new Set([...first.shapes, ...second.shapes].map((s) => s.id)).size,
    1100,
  )
  assert.equal(second.nextOffset, null)
  const found = await run('read_canvas', {
    scope: 'page',
    text: 'important label',
  })
  assert.equal(found.shapes.length, 1)
  assert.equal(found.shapes[0].text, longLabel.trim())
  assert.deepEqual(errors, [])
})

test('relative moves inside rotated parents use page coordinates and locked ancestors are protected', async () => {
  await run('create_shapes', {
    shapes: [box('child', 100, 100), box('sibling', 300, 100)],
  })
  await page.evaluate(() => {
    const { editor } = window.canvasFixture
    editor.groupShapes(['shape:child', 'shape:sibling'], {
      groupId: 'shape:group',
    })
    editor.updateShape({
      id: 'shape:group',
      type: 'group',
      rotation: Math.PI / 2,
    })
  })
  const before = (await run('read_canvas', { ids: ['child'] })).shapes[0]
  const moved = await run('update_shapes', {
    ids: ['child'],
    patch: { dx: 120, dy: 60 },
  })
  assert.ok(Math.abs(moved.shapes[0].x - before.x - 120) <= 1)
  assert.ok(Math.abs(moved.shapes[0].y - before.y - 60) <= 1)
  await page.evaluate(() => {
    window.canvasFixture.editor.updateShape({
      id: 'shape:group',
      type: 'group',
      isLocked: true,
    })
  })
  const blocked = await run('update_shapes', {
    ids: ['child'],
    patch: { dx: 50 },
  })
  assert.equal(blocked.updated.length, 0)
  assert.match(blocked.errors[0].error, /locked/)
  await assert.rejects(run('arrange_shapes', { ids: ['child'] }), /locked/)
  const deletion = await run('delete_shapes', { ids: ['group'] })
  assert.equal(deletion.deleted.length, 0)
  assert.match(deletion.errors[0].error, /descendant is locked/)
  assert.deepEqual(errors, [])
})

test('bound relationships follow nodes and connector styling can be updated', async () => {
  await run('create_shapes', { shapes: [box('a'), box('b', 400)] })
  const connected = await run('connect_shapes', {
    connections: [
      {
        id: 'link',
        from: 'a',
        to: 'b',
        text: 'depends on',
        kind: 'elbow',
        dash: 'dashed',
        arrowheadStart: 'dot',
      },
    ],
  })
  assert.equal(connected.created[0].from, 'a')
  const before = connected.created[0]
  await run('update_shapes', { ids: ['b'], patch: { dy: 300 } })
  const after = (await run('read_canvas', { ids: ['link'], detail: 'full' }))
    .shapes[0]
  assert.equal(after.to, 'b')
  assert.notEqual(after.h, before.h)
  const styled = await run('update_shapes', {
    ids: ['link'],
    patch: { color: 'violet', labelColor: 'black', arrowheadEnd: 'triangle' },
  })
  assert.equal(styled.shapes[0].arrowheadEnd, 'triangle')
  assert.deepEqual(errors, [])
})

test('inspection reports neighboring overlaps and excludes intentional text containment', async () => {
  await run('create_shapes', {
    shapes: [
      box('a'),
      box('b', 80),
      {
        id: 'label',
        type: 'text',
        x: 10,
        y: 10,
        w: 100,
        text: 'inside',
        size: 's',
      },
    ],
  })
  const inspection = await run('inspect_scene', { ids: ['a'], maxIssues: 1 })
  assert.equal(inspection.issues[0].kind, 'overlap')
  assert.deepEqual(inspection.issues[0].ids, ['a', 'b'])
  assert.equal(inspection.totalIssues, 1)
})

test('duplicate asynchronous calls apply once and the whole turn can be undone', async () => {
  const result = await page.evaluate(async () => {
    const { runner, editor } = window.canvasFixture
    runner.beginTurn()
    const input = {
      nodes: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    }
    const [first, replay] = await Promise.all([
      runner.run('diagram-call', 'create_diagram', input),
      runner.run('diagram-call', 'create_diagram', input),
    ])
    await runner.run('style-call', 'update_shapes', {
      ids: ['a', 'b'],
      patch: { color: 'green' },
    })
    const before = editor.getCurrentPageShapes().length
    editor.undo()
    return {
      applied: [first.applied, replay.applied],
      before,
      after: editor.getCurrentPageShapes().length,
    }
  })
  assert.deepEqual(result, { applied: [true, false], before: 3, after: 0 })
  assert.deepEqual(errors, [])
})

test('invalid relationships and duplicate ids are rejected before any shapes are created', async () => {
  await assert.rejects(
    run('create_shapes', {
      shapes: [box('a'), { type: 'arrow', from: 'a', to: 'missing' }],
    }),
    /No shape/,
  )
  await assert.rejects(
    run('create_diagram', { nodes: [node('a'), node('a')] }),
    /Duplicate/,
  )
  assert.equal((await run('read_canvas', { scope: 'page' })).total, 0)
})

test('connectors can be rebound without duplication and missing targets leave them intact', async () => {
  await run('create_shapes', {
    shapes: [box('a'), box('b', 400), box('c', 400, 300)],
  })
  await run('connect_shapes', {
    connections: [{ id: 'link', from: 'a', to: 'b' }],
  })
  const rebound = await run('connect_shapes', {
    connections: [
      {
        arrowId: 'link',
        from: 'a',
        to: 'c',
        text: 'changed',
        toAnchor: { x: 0, y: 0.5 },
      },
    ],
  })
  assert.equal(rebound.created.length, 0)
  assert.deepEqual(rebound.updated, ['link'])
  assert.equal(rebound.connected[0].to, 'c')
  await assert.rejects(
    run('connect_shapes', {
      connections: [{ arrowId: 'link', from: 'a', to: 'missing' }],
    }),
    /Shape not found/,
  )
  const read = await run('read_canvas', { scope: 'page', types: ['arrow'] })
  assert.equal(read.shapes.length, 1)
  assert.equal(read.shapes[0].to, 'c')
  assert.deepEqual(errors, [])
})

test('character budgets preserve whole labels and allow the remainder to be paginated', async () => {
  const label = 'A complete label that should remain intact. '.repeat(35)
  await run('create_shapes', {
    shapes: Array.from({ length: 20 }, (_, i) => ({
      ...box(`label-${i}`, i * 400),
      text: label,
    })),
  })
  const first = await run('read_canvas', { scope: 'page', maxChars: 8192 })
  assert.ok(first.shapes.length < 20)
  assert.ok(first.shapes.every((shape) => shape.text === label.trim()))
  assert.ok(first.nextOffset > 0)
  assert.ok(JSON.stringify(first.shapes).length < 8192)
  const next = await run('read_canvas', {
    scope: 'page',
    offset: first.nextOffset,
    maxChars: 8192,
  })
  assert.equal(first.shapes[0].id === next.shapes[0].id, false)
})

test('layout refuses to overwrite shapes edited while its worker is calculating', async () => {
  await run('create_shapes', { shapes: [box('a'), box('b', 400)] })
  const result = await page.evaluate(async () => {
    const { run, editor } = window.canvasFixture
    const pending = run('arrange_shapes', {
      ids: ['a', 'b'],
      layout: { mode: 'flow' },
    }).then(
      () => 'unexpected success',
      (error) => error.message,
    )
    editor.updateShape({ id: 'shape:a', type: 'geo', x: 777 })
    const message = await pending
    return { message, x: editor.getShape('shape:a').x }
  })
  assert.match(result.message, /changed while layout/)
  assert.equal(result.x, 777)
})

test('explicit connector styles are preserved and crossing diagnostics identify the blocking node', async () => {
  await run('create_shapes', {
    shapes: [box('a'), box('b', 400), box('blocker', 200)],
  })
  await run('connect_shapes', {
    connections: [{ id: 'link', from: 'a', to: 'b', kind: 'elbow' }],
  })
  const inspection = await run('inspect_scene', { ids: ['link'] })
  assert.ok(
    inspection.issues.some(
      (issue) =>
        issue.kind === 'connector-crossing' && issue.ids.includes('blocker'),
    ),
  )
  const rebound = await run('connect_shapes', {
    connections: [{ arrowId: 'link', from: 'a', to: 'b' }],
  })
  assert.equal(rebound.connected[0].kind, 'elbow')
})
