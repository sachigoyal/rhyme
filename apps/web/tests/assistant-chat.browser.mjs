import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { chromium } from 'playwright'

let server,
  browser,
  page,
  origin,
  releaseCreate,
  connectionData,
  createFailure,
  creations,
  sends,
  errors,
  sockets,
  socketFailure
const connection = {
  id: '69e3c2b3-72af-42db-b600-7cd9e893f2cc',
  name: 'My OpenAI',
  provider: 'openai',
  baseUrl: '',
  models: ['gpt-6-astra', 'gpt-6.1-sol'],
  vision: false,
  serviceTier: 'ultrafast',
  keyHint: 'test',
}
const result = (data) => ({ result: { data: { json: data } } })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

before(async () => {
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    cacheDir: 'node_modules/.vite-assistant-tests',
    appType: 'custom',
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwind(),
      react(),
      {
        name: 'assistant-fixture',
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (request.url !== '/') return next()
            response.setHeader('Content-Type', 'text/html')
            response.end(
              await vite.transformIndexHtml(
                '/',
                '<html><body><div id="root"></div><script type="module" src="/tests/fixtures/assistant-chat.tsx"></script></body></html>',
              ),
            )
          })
        },
      },
    ],
    optimizeDeps: { entries: ['tests/fixtures/assistant-chat.tsx'] },
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
  await page?.context().close()
  connectionData = [connection]
  createFailure = false
  creations = []
  sends = []
  errors = []
  sockets = []
  socketFailure = false
  page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
  page.setDefaultTimeout(15000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('http://localhost:8787/trpc/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const paths = url.pathname.split('/trpc/')[1].split(',')
    const inputs =
      request.method() === 'POST'
        ? request.postDataJSON()
        : JSON.parse(url.searchParams.get('input') || '{}')
    const replies = []
    for (const [index, path] of paths.entries()) {
      const input = inputs[index]?.json ?? inputs.json
      if (path === 'chats.create') {
        creations.push(input)
        await new Promise((resolve) => {
          releaseCreate = resolve
        })
        if (createFailure) {
          replies.push({
            error: {
              json: {
                message: 'Creation failed',
                code: -32603,
                data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
              },
            },
          })
          continue
        }
        replies.push(
          result({
            id: input.id,
            fileId: input.fileId,
            title: 'New conversation',
            titleSource: 'pending',
          }),
        )
      } else if (path === 'aiConnections.list')
        replies.push(result(connectionData))
      else if (path === 'chats.get')
        replies.push(
          result({
            chat: { id: input.id },
            messages: [
              {
                id: 'old-user',
                role: 'user',
                parts: [{ type: 'text', text: 'Previous message' }],
              },
            ],
            changes: [],
          }),
        )
      else replies.push(result([]))
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        url.searchParams.has('batch') ? replies : replies[0],
      ),
    })
  })
  await page.routeWebSocket(/localhost:8787/, async (socket) => {
    sockets.push(socket)
    socket.onMessage(async (raw) => {
      const frame = JSON.parse(raw)
      if (frame.type === 'cf_agent_stream_resume')
        socket.send(
          JSON.stringify({
            type: 'cf_agent_stream_resume_none',
            reason: 'idle',
            probeId: frame.probeId,
          }),
        )
      if (frame.type !== 'cf_agent_use_chat_request') return
      sends.push(JSON.parse(frame.init.body))
      const chunk = (body, done = false) =>
        socket.send(
          JSON.stringify({
            type: 'cf_agent_use_chat_response',
            id: frame.id,
            body: body ? JSON.stringify(body) : '',
            done,
          }),
        )
      chunk({ type: 'start', messageId: 'assistant-reply' })
      chunk({ type: 'text-start', id: 'text' })
      chunk({ type: 'text-delta', id: 'text', delta: 'Streaming reply' })
      await wait(150)
      chunk({ type: 'text-end', id: 'text' })
      chunk({ type: 'finish', finishReason: 'stop' })
      chunk(null, true)
    })
    await wait(50)
    if (socketFailure) {
      socket.close({ code: 1008, reason: 'Connection denied' })
      return
    }
    socket.send(
      JSON.stringify({
        type: 'cf_agent_identity',
        name: new URL(socket.url()).pathname.split('/')[4],
        agent: 'canvas-agent',
      }),
    )
    socket.send(
      JSON.stringify({
        type: 'cf_agent_state',
        state: {
          status: 'ready',
          config: {
            model: '@cf/moonshotai/kimi-k2.6',
            temperature: 0.6,
            maxOutputTokens: 4096,
            maxSteps: 8,
            reasoning: 'high',
          },
        },
      }),
    )
  })
  await page.goto(origin)
  await page.getByRole('textbox', { name: 'Message Rhyme' }).waitFor()
})
after(async () => {
  await browser?.close()
  await server?.close()
})

async function selectAstra() {
  await page.getByRole('button', { name: 'Choose model' }).click()
  await page
    .getByRole('menuitemradio', { name: 'gpt-6-astra', exact: true })
    .click()
}
async function submit(text = 'Make a diagram') {
  await page.getByRole('textbox', { name: 'Message Rhyme' }).fill(text)
  await page.getByRole('textbox', { name: 'Message Rhyme' }).press('Enter')
  await page.waitForFunction(() =>
    document.querySelector('[data-slot="message"]'),
  )
}

test('Enter immediately shows the user message and keeps the composer mounted through creation and streaming', async () => {
  await selectAstra()
  await submit()
  assert.equal(
    await page.getByText('What shall we make?', { exact: true }).count(),
    0,
  )
  assert.equal(await page.locator('[data-slot="skeleton"]').count(), 0)
  assert.equal(sends.length, 0)
  await page.evaluate(() => {
    window.pendingComposer = document.querySelector('textarea')
    window.pendingMessage = document.querySelector('[data-slot=message]')
    window.flashes = []
    new MutationObserver(() => {
      if (
        document.querySelector('[data-slot="skeleton"]') ||
        document.body.textContent.includes('What shall we make?')
      )
        window.flashes.push(document.body.textContent)
    }).observe(document.getElementById('root'), {
      subtree: true,
      childList: true,
    })
  })
  releaseCreate()
  await page.getByText('Streaming reply', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'New conversation' })
    .waitFor({ state: 'visible' })
  assert.equal(
    await page.evaluate(
      () => window.pendingComposer === document.querySelector('textarea'),
    ),
    true,
  )
  assert.equal(
    await page.evaluate(
      () =>
        window.pendingMessage === document.querySelector('[data-slot=message]'),
    ),
    true,
  )
  assert.deepEqual(await page.evaluate(() => window.flashes), [])
  assert.equal(sends.length, 1)
  assert.equal(sends[0].config.model, 'gpt-6-astra')
  assert.equal(
    sends[0].messages.filter((message) => message.role === 'user').length,
    1,
  )
  assert.equal(creations.length, 1)
  assert.match(creations[0].id, /^[0-9a-f-]{36}$/)
  assert.deepEqual(errors, [])
})

test('model and speed survive new chats, panel reopening and page reload, ignoring chat-specific server config', async () => {
  await selectAstra()
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).textContent(),
    'Ultrafast',
  )
  await page.getByRole('button', { name: 'Response speed' }).click()
  await page
    .getByRole('menuitemradio', { name: 'Standard', exact: true })
    .click()
  await submit()
  releaseCreate()
  await page.getByText('Streaming reply', { exact: true }).waitFor()
  await wait(300)
  assert.equal(sends[0].config.serviceTier, 'standard')
  await page.getByRole('button', { name: 'New conversation' }).click()
  assert.match(
    await page.getByRole('button', { name: 'Choose model' }).textContent(),
    /gpt-6-astra/,
  )
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).textContent(),
    'Standard',
  )
  await page.getByText('Toggle panel', { exact: true }).click()
  await page.getByText('Toggle panel', { exact: true }).click()
  assert.match(
    await page.getByRole('button', { name: 'Choose model' }).textContent(),
    /gpt-6-astra/,
  )
  await page.reload()
  await page.getByRole('textbox', { name: 'Message Rhyme' }).waitFor()
  assert.match(
    await page.getByRole('button', { name: 'Choose model' }).textContent(),
    /gpt-6-astra/,
  )
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).textContent(),
    'Standard',
  )
  assert.deepEqual(errors, [])
})

test('creation failure preserves prompt and draft; retry reuses its ID and sends once', async () => {
  createFailure = true
  await submit('Keep this prompt')
  await page.getByRole('textbox', { name: 'Message Rhyme' }).fill('Next draft')
  releaseCreate()
  await page.getByText('Creation failed', { exact: true }).waitFor()
  assert.equal(
    await page.getByText('Keep this prompt', { exact: true }).count(),
    1,
  )
  assert.equal(
    await page.getByRole('textbox', { name: 'Message Rhyme' }).inputValue(),
    'Next draft',
  )
  createFailure = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await wait(50)
  releaseCreate()
  await page.getByText('Streaming reply', { exact: true }).waitFor()
  assert.equal(creations[0].id, creations[1].id)
  assert.equal(sends.length, 1)
  assert.equal(
    await page.getByRole('textbox', { name: 'Message Rhyme' }).inputValue(),
    'Next draft',
  )
  assert.deepEqual(errors, [])
})

test('cached connections render immediately and reconcile removals without a skeleton', async () => {
  await selectAstra()
  await page.route(
    'http://localhost:8787/trpc/aiConnections.list*',
    async (route) => {
      await wait(600)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([result([])]),
      })
    },
  )
  await page.reload()
  await page.getByRole('textbox', { name: 'Message Rhyme' }).waitFor()
  assert.match(
    await page.getByRole('button', { name: 'Choose model' }).textContent(),
    /My OpenAI/,
  )
  assert.equal(await page.locator('[data-slot="skeleton"]').count(), 0)
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="Choose model"]')
      .textContent.includes('Kimi'),
  )
  assert.deepEqual(errors, [])
})

test('speed is shown only for supported OpenAI models and inherits each connection default', async () => {
  await selectAstra()
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).textContent(),
    'Ultrafast',
  )
  await page.getByRole('button', { name: 'Choose model' }).click()
  await page
    .getByRole('menuitemradio', { name: 'gpt-6.1-sol', exact: true })
    .click()
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).count(),
    0,
  )
  await selectAstra()
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).textContent(),
    'Ultrafast',
  )
  assert.deepEqual(errors, [])
})

test('saved connection Test sends only accepted input fields', async () => {
  let tested
  await page.route(
    'http://localhost:8787/trpc/aiConnections.test*',
    async (route) => {
      tested = route.request().postDataJSON()['0'].json
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          result({ model: 'gpt-6-astra', message: 'Connected' }),
        ]),
      })
    },
  )
  await page.getByRole('button', { name: 'Toggle settings' }).click()
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await page.getByText('gpt-6-astra: Connected', { exact: true }).waitFor()
  const { keyHint, ...expected } = connection
  assert.deepEqual(tested, expected)
  assert.equal('apiKey' in tested, false)
  assert.deepEqual(errors, [])
})

test('BYOK settings edit and persist the connection default tier', async () => {
  let saved
  await page.route(
    'http://localhost:8787/trpc/aiConnections.save*',
    async (route) => {
      saved = route.request().postDataJSON()['0'].json
      connectionData = [{ ...connection, serviceTier: saved.serviceTier }]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([result(connectionData[0])]),
      })
    },
  )
  await page.getByRole('button', { name: 'Toggle settings' }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  assert.equal(
    await page
      .getByRole('switch', { name: 'Default to Ultrafast' })
      .getAttribute('aria-checked'),
    'true',
  )
  await page.getByRole('switch', { name: 'Default to Ultrafast' }).click()
  await page.getByRole('button', { name: 'Test and save' }).click()
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
  assert.equal(saved.serviceTier, 'standard')
  assert.equal(saved.id, connection.id)
  await selectAstra()
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).textContent(),
    'Standard',
  )
  assert.deepEqual(errors, [])
})

test('persisted preferences and connection metadata are isolated by account', async () => {
  await selectAstra()
  await page.getByRole('button', { name: 'Toggle panel' }).click()
  connectionData = []
  await page.evaluate(() => {
    const fixture = window.assistantFixture
    fixture.queryClient.clear()
    fixture.queryClient.setQueryData(['session'], {
      user: { id: 'other-user' },
    })
  })
  await page.getByRole('button', { name: 'Toggle panel' }).click()
  assert.match(
    await page.getByRole('button', { name: 'Choose model' }).textContent(),
    /Kimi/,
  )
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).count(),
    0,
  )
  await page.getByRole('button', { name: 'Choose model' }).click()
  assert.equal(
    await page
      .getByRole('menuitemradio', { name: 'gpt-6-astra', exact: true })
      .count(),
    0,
  )
  assert.deepEqual(errors, [])
})

test('model, speed, and send controls fit a narrow panel without overflowing', async () => {
  await page.setViewportSize({ width: 300, height: 800 })
  await selectAstra()
  const bounds = await page
    .locator('[data-slot="input-group"]')
    .evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
    }))
  assert.ok(bounds.scroll <= bounds.width + 1, JSON.stringify(bounds))
  assert.equal(
    await page.getByRole('button', { name: 'Response speed' }).isVisible(),
    true,
  )
  if (process.env.ASSISTANT_SCREENSHOT_PATH)
    await page.screenshot({
      path: process.env.ASSISTANT_SCREENSHOT_PATH,
      animations: 'disabled',
    })
  assert.deepEqual(errors, [])
})

test('a terminal connection failure keeps the optimistic message and unlocks retry', async () => {
  socketFailure = true
  await submit('Do not lose this message')
  releaseCreate()
  await page.getByRole('button', { name: 'Retry connection' }).waitFor()
  assert.equal(sends.length, 0)
  assert.equal(
    await page.getByRole('button', { name: 'New conversation' }).isEnabled(),
    true,
  )
  assert.equal(
    await page.getByText('Do not lose this message', { exact: true }).count(),
    1,
  )
  socketFailure = false
  await page.getByRole('button', { name: 'Retry connection' }).click()
  await page.getByText('Streaming reply', { exact: true }).waitFor()
  assert.equal(sends.length, 1)
  assert.deepEqual(errors, [])
})
