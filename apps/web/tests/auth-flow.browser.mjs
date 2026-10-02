import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer, preview } from 'vite'
import { chromium } from 'playwright'

let server,
  browser,
  page,
  origin,
  signedIn,
  profile,
  files,
  imports,
  importFailure,
  profileFailure,
  sessionFailure
const user = { id: 'test-user', name: 'Example', email: 'test@example.com' }
const session = {
  user,
  session: { id: 'test-session', expiresAt: '2099-01-01T00:00:00.000Z' },
}
const errors = []
const document = {
  store: { 'shape:test': { id: 'shape:test', typeName: 'shape' } },
  schema: {},
}
const draft = (extra = {}) => ({
  id: 'ae687503-a761-4f38-a761-d425b51e958d',
  document,
  ...extra,
})
const summary = (id) => ({
  id,
  name: 'Untitled',
  folderId: null,
  version: 1,
  lastEditedById: user.id,
  hasThumbnail: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  trashedAt: null,
  owner: user,
  role: 'owner',
})
function result(data) {
  const values = {}
  for (const [index, file] of (Array.isArray(data) ? data : [data]).entries()) {
    if (!file?.createdAt) continue
    for (const key of ['createdAt', 'updatedAt'])
      values[Array.isArray(data) ? `${index}.${key}` : key] = ['Date']
  }
  return {
    result: {
      data: {
        json: data,
        ...(Object.keys(values).length ? { meta: { values, v: 1 } } : {}),
      },
    },
  }
}

before(async () => {
  const root = new URL('../', import.meta.url).pathname
  server = process.env.AUTH_TEST_BUILD
    ? await preview({ root, preview: { port: 0, host: '127.0.0.1' } })
    : await createServer({ root, server: { port: 0, host: '127.0.0.1' } })
  if (!process.env.AUTH_TEST_BUILD) await server.listen()
  origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  })
})
beforeEach(async () => {
  await page?.context().close()
  signedIn = true
  profile = { userId: user.id, analyticsConsent: false }
  files = []
  imports = []
  importFailure = false
  profileFailure = false
  sessionFailure = false
  errors.length = 0
  page = await browser.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === new URL(origin).origin) {
      await route.continue()
      return
    }
    if (
      new URL(route.request().url()).hostname === 'cdn.tldraw.com' &&
      route.request().method() === 'GET'
    ) {
      await route.continue()
      return
    }
    if (
      !['localhost:8787', 'rhyme.sachi.dev'].includes(
        new URL(route.request().url()).host,
      )
    ) {
      await route.abort()
      return
    }
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': new URL(origin).origin,
      'access-control-allow-credentials': 'true',
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        headers: {
          ...headers,
          'access-control-allow-methods': 'GET,POST',
          'access-control-allow-headers': 'content-type',
        },
      })
      return
    }
    if (url.pathname.endsWith('/get-session') && sessionFailure) {
      await route.fulfill({
        headers,
        status: 500,
        json: { message: 'Session temporarily unavailable' },
      })
      return
    }
    if (url.pathname.startsWith('/auth/')) {
      if (url.pathname.endsWith('/sign-out')) signedIn = false
      if (url.pathname.endsWith('/sign-in/email-otp')) signedIn = true
      await route.fulfill({
        headers,
        json: url.pathname.endsWith('/get-session')
          ? signedIn
            ? session
            : null
          : { success: true },
      })
      return
    }
    const input =
      request.method() === 'POST'
        ? request.postDataJSON()
        : JSON.parse(url.searchParams.get('input') ?? '{}')
    const responses = url.pathname
      .slice('/trpc/'.length)
      .split(',')
      .map((path, index) => {
        if (path === 'files.importGuest') {
          imports.push(input[index].json)
          if (importFailure)
            return {
              error: {
                json: {
                  message: 'Import temporarily unavailable',
                  code: -32603,
                  data: {
                    code: 'INTERNAL_SERVER_ERROR',
                    httpStatus: 500,
                    path,
                  },
                },
              },
            }
          const file = summary(input[index].json.id)
          files = [file]
          return result(file)
        }
        if (path === 'profile.complete') {
          profile = { userId: user.id, ...input[index].json }
          return result({ completedAt: new Date().toISOString() })
        }
        if (path === 'profile.get' && profileFailure) {
          signedIn = false
          return {
            error: {
              json: {
                message: 'Session expired',
                code: -32001,
                data: { code: 'UNAUTHORIZED', httpStatus: 401, path },
              },
            },
          }
        }
        if (path === 'profile.get') return result(profile)
        if (path === 'files.list') return result(files)
        if (path === 'settings.get')
          return result({
            homeDestination: 'dashboard',
            theme: 'system',
            showGrid: false,
            snapToShapes: false,
            openAssistant: false,
            lastEditedCanvasId: null,
          })
        return result([])
      })
    await route.fulfill({ headers, json: responses })
  })
})
after(async () => {
  await browser?.close()
  if (process.env.AUTH_TEST_BUILD)
    await new Promise((resolve) => server.httpServer.close(resolve))
  else await server?.close()
})
async function seed(saved) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem('rhyme:signup-draft'))
      localStorage.setItem('rhyme:signup-draft', JSON.stringify(value))
  }, saved)
}
async function verifyCode() {
  await page.getByLabel('Email address').fill(user.email)
  await page.getByRole('button', { name: 'Continue with email' }).click()
  await page.getByLabel('Verification code').fill('123456')
}
async function assertWorkspace() {
  await page.waitForURL((url) => url.pathname === '/files')
  await page.getByRole('heading', { name: 'Canvases', exact: true }).waitFor()
  assert.deepEqual(errors, [])
}

test('reported completion URL works for a returning account without a drawing', async () => {
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await assertWorkspace()
  assert.equal(imports.length, 0)
})
test('guest drawing imports once after OTP and is cleared only after success', async () => {
  signedIn = false
  await seed(draft())
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await page.waitForURL((url) => url.pathname === '/sign-in')
  await verifyCode()
  await assertWorkspace()
  assert.equal(imports.length, 1)
  assert.deepEqual(imports[0].document, document)
  assert.equal(
    await page.evaluate(() => localStorage.getItem('rhyme:signup-draft')),
    null,
  )
})
test('legacy empty draft does not create a file for a returning account', async () => {
  await seed(
    draft({
      document: { store: { 'page:test': { typeName: 'page' } }, schema: {} },
    }),
  )
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await assertWorkspace()
  assert.equal(imports.length, 0)
})
test('failed guest import remains recoverable and retry reuses the file id', async () => {
  importFailure = true
  await seed(draft())
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await page
    .getByRole('heading', { name: 'Unable to finish sign-in' })
    .waitFor()
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('rhyme:signup-draft')),
  )
  assert.deepEqual(saved.document, document)
  importFailure = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await assertWorkspace()
  assert.equal(imports.length, 2)
  assert.equal(imports[0].id, imports[1].id)
})
test('draft claimed by another account offers sign-out without deleting the drawing', async () => {
  await seed(
    draft({
      import: {
        userId: 'another-user',
        fileId: 'dc271ea4-2603-4e2c-bbf7-576cc2e9f819',
      },
    }),
  )
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await page
    .getByText('Sign in to the account that started saving this canvas.')
    .waitFor()
  await page.getByRole('button', { name: 'Use another account' }).click()
  await page.waitForURL((url) => url.pathname === '/sign-in')
  assert.ok(
    await page.evaluate(() => localStorage.getItem('rhyme:signup-draft')),
  )
  assert.equal(imports.length, 0)
  assert.deepEqual(errors, [])
})
test('OTP preserves protected destination, query parameters, and hash', async () => {
  signedIn = false
  await page.goto(`${origin}files?view=shared&layout=list#saved`)
  await page.waitForURL((url) => url.pathname === '/sign-in')
  await verifyCode()
  await page.waitForURL(
    (url) =>
      url.pathname === '/files' && url.searchParams.get('view') === 'shared',
  )
  assert.equal(new URL(page.url()).searchParams.get('layout'), 'list')
  assert.equal(new URL(page.url()).hash, '#saved')
  assert.deepEqual(errors, [])
})
test('already signed-in sign-in page keeps the requested destination', async () => {
  await page.goto(
    `${origin}sign-in?redirect=${encodeURIComponent('/files?view=trash')}`,
  )
  await page.waitForURL(
    (url) =>
      url.pathname === '/files' && url.searchParams.get('view') === 'trash',
  )
  assert.deepEqual(errors, [])
})
test('recursive and external redirects fall back without a route crash', async () => {
  for (const redirect of [
    '/auth/complete',
    '/onboarding',
    '//example.com',
    '/%5cexample.com',
  ]) {
    await page.goto(
      `${origin}auth/complete?redirect=${encodeURIComponent(redirect)}`,
    )
    await assertWorkspace()
  }
})
test('new account completes onboarding and returns to its original destination', async () => {
  profile = null
  signedIn = false
  await seed(draft())
  await page.goto(`${origin}files?view=shared`)
  await page.waitForURL((url) => url.pathname === '/sign-in')
  await verifyCode()
  await page.waitForURL((url) => url.pathname === '/onboarding')
  await page.getByRole('textbox', { name: 'Your name' }).fill('Example')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByText('Don’t share usage analytics', { exact: true }).click()
  await page.getByRole('button', { name: 'Finish setup' }).click()
  await page.waitForURL(
    (url) =>
      url.pathname === '/files' && url.searchParams.get('view') === 'shared',
  )
  assert.equal(imports.length, 1)
  assert.deepEqual(errors, [])
})
test('expired session is checked again on protected navigation', async () => {
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await assertWorkspace()
  signedIn = false
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/sign-in')
  assert.match(new URL(page.url()).searchParams.get('redirect'), /^\/settings/)
  assert.deepEqual(errors, [])
})

test('session service failures show recovery instead of pretending the user is signed out', async () => {
  sessionFailure = true
  await page.goto(`${origin}auth/complete?redirect=%2Ffiles`)
  await page.getByRole('heading', { name: 'Unable to load page' }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/auth/complete')
  sessionFailure = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await assertWorkspace()
})

test('API session expiration during completion preserves the requested destination', async () => {
  profileFailure = true
  await page.goto(
    `${origin}auth/complete?redirect=${encodeURIComponent('/files?view=shared')}`,
  )
  await page.waitForURL((url) => url.pathname === '/sign-in')
  assert.equal(
    new URL(page.url()).searchParams.get('redirect'),
    '/files?view=shared',
  )
  profileFailure = false
  await verifyCode()
  await page.waitForURL(
    (url) =>
      url.pathname === '/files' && url.searchParams.get('view') === 'shared',
  )
  assert.deepEqual(errors, [])
})

test('untouched guest canvas can sign in without creating an empty file', async () => {
  signedIn = false
  await page.goto(origin)
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true })
  await signIn.waitFor()
  await signIn.click()
  await page.waitForURL((url) => url.pathname === '/sign-in')
  await verifyCode()
  await assertWorkspace()
  assert.equal(imports.length, 0)
})
