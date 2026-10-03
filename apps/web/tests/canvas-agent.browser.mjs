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

test('agent creation renders progressively, saves the final scene once, and undoes together', async () => {
  await page.evaluate(() => {
    const { editor, runner, sync } = window.canvasFixture
    const release = sync.beginBatch()
    const frames = []
    const stop = editor.store.listen(
      () => frames.push(editor.getCurrentPageShapeIds().size),
      { source: 'user', scope: 'document' },
    )
    const shapes = Array.from({ length: 20 }, (_, index) => ({
      id: `live-${index}`,
      type: 'geo',
      x: 40 + (index % 7) * 180,
      y: 40 + Math.floor(index / 7) * 120,
      w: 160,
      h: 100,
      text: `Step ${index + 1}`,
      color: index % 2 ? 'blue' : 'green',
    }))
    Object.assign(window.canvasFixture, {
      frames,
      release,
      stop,
      pending: runner.run('live-build', 'create_shapes', { shapes }),
    })
  })
  await page.waitForFunction(() => {
    const count = window.canvasFixture.editor.getCurrentPageShapeIds().size
    return count >= 2 && count < 20
  })
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 0)
  if (process.env.CANVAS_SCREENSHOT_DIR) {
    await mkdir(process.env.CANVAS_SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({
      path: `${process.env.CANVAS_SCREENSHOT_DIR}/live-build-progress.png`,
    })
  }
  const result = await page.evaluate(async () => {
    const fixture = window.canvasFixture
    const execution = await fixture.pending
    fixture.stop()
    await fixture.runner.run('live-color', 'update_shapes', {
      updates: [{ id: 'live-0', color: 'red' }],
    })
    await fixture.sync.flush()
    return {
      frames: fixture.frames,
      saves: fixture.saves.length,
      created: execution.result.output.created.length,
    }
  })
  assert.equal(result.created, 20)
  assert.equal(result.saves, 0)
  assert.ok(result.frames.some((count) => count > 0 && count < 20))
  await page.evaluate(() => window.canvasFixture.release())
  await page.waitForFunction(
    () => window.canvasFixture.sync.getStatus() === 'saved',
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  const savedCount = await page.evaluate(
    () =>
      Object.values(window.canvasFixture.saves[0].document.store).filter(
        (record) => record.typeName === 'shape',
      ).length,
  )
  assert.equal(savedCount, 20)
  if (process.env.CANVAS_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.CANVAS_SCREENSHOT_DIR}/live-build-finished.png`,
    })
  await page.evaluate(() => window.canvasFixture.editor.undo())
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    0,
  )
  assert.deepEqual(errors, [])
})

test('stopping a live build saves its completed portion without drawing the remaining shapes', async () => {
  await page.evaluate(() => {
    const fixture = window.canvasFixture
    const shapes = Array.from({ length: 30 }, (_, index) => ({
      id: `partial-${index}`,
      type: 'geo',
      x: index * 180,
      y: 0,
      w: 160,
      h: 100,
    }))
    fixture.pending = fixture.runner.run('partial-build', 'create_shapes', {
      shapes,
    })
  })
  await page.waitForFunction(
    () => window.canvasFixture.editor.getCurrentPageShapeIds().size >= 2,
  )
  const created = await page.evaluate(async () => {
    const fixture = window.canvasFixture
    fixture.runner.cancel()
    const execution = await fixture.pending
    return execution.result.output.created.length
  })
  assert.ok(created >= 2 && created < 30)
  await page.waitForFunction(
    () => window.canvasFixture.sync.getStatus() === 'saved',
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
  assert.equal(
    await page.evaluate(
      () => window.canvasFixture.editor.getCurrentPageShapeIds().size,
    ),
    created,
  )
  assert.deepEqual(errors, [])
})

test('leaving during a build saves the completed scene despite outstanding batch holds', async () => {
  await page.evaluate(() => {
    const fixture = window.canvasFixture
    fixture.release = fixture.sync.beginBatch()
    fixture.pending = fixture.runner.run('exit-build', 'create_shapes', {
      shapes: Array.from({ length: 30 }, (_, index) => ({
        id: `exit-${index}`,
        type: 'geo',
        x: index * 180,
        y: 0,
        w: 160,
        h: 100,
      })),
    })
  })
  await page.waitForFunction(
    () => window.canvasFixture.editor.getCurrentPageShapeIds().size >= 2,
  )
  const result = await page.evaluate(async () => {
    const fixture = window.canvasFixture
    fixture.runner.cancel()
    fixture.detach()
    const execution = await fixture.pending
    fixture.release()
    await fixture.sync.flush()
    return {
      created: execution.result.output.created.length,
      saves: fixture.saves.length,
      savedShapes: Object.values(fixture.saves[0].document.store).filter(
        (record) => record.typeName === 'shape',
      ).length,
    }
  })
  assert.ok(result.created >= 2 && result.created < 30)
  assert.equal(result.saves, 1)
  assert.equal(result.savedShapes, result.created)
  assert.deepEqual(errors, [])
})

test('live diagrams reveal their nodes before bound connectors and save after routing', async () => {
  const result = await page.evaluate(async () => {
    const fixture = window.canvasFixture
    const frames = []
    const stop = fixture.editor.store.listen(
      () => {
        const shapes = fixture.editor.getCurrentPageShapesSorted()
        frames.push({
          nodes: shapes.filter((shape) => shape.type !== 'arrow').length,
          arrows: shapes.filter((shape) => shape.type === 'arrow').length,
        })
      },
      { source: 'user', scope: 'document' },
    )
    const execution = await fixture.runner.run(
      'live-diagram',
      'create_diagram',
      {
        nodes: Array.from({ length: 5 }, (_, index) => ({
          id: `node-${index}`,
          text: `Step ${index + 1}`,
        })),
        edges: Array.from({ length: 4 }, (_, index) => ({
          from: `node-${index}`,
          to: `node-${index + 1}`,
        })),
      },
    )
    stop()
    return { frames, output: execution.result.output }
  })
  assert.equal(result.output.created.length, 9)
  assert.ok(result.frames.some((frame) => frame.nodes > 0 && frame.nodes < 5))
  assert.ok(
    result.frames
      .filter((frame) => frame.arrows > 0)
      .every((frame) => frame.nodes === 5),
  )
  assert.ok(
    result.output.created
      .filter((shape) => shape.type === 'arrow')
      .every((shape) => shape.from && shape.to),
  )
  await page.waitForFunction(
    () => window.canvasFixture.sync.getStatus() === 'saved',
  )
  assert.equal(await page.evaluate(() => window.canvasFixture.saves.length), 1)
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
