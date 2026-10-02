import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'))
const { build } = wranglerRequire('esbuild')
const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
let worker

before(async () => {
  const result = await build({
    entryPoints: [resolve(root, 'src/production.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    plugins: [
      {
        name: 'api-fixture',
        setup(build) {
          build.onResolve(
            { filter: /^\.\/(?:index|agents\/canvas-agent)$/ },
            () => ({
              path: 'api',
              namespace: 'fixture',
            }),
          )
          build.onLoad({ filter: /^api$/, namespace: 'fixture' }, () => ({
            contents: `
            export class CanvasAgent {}
            export default { fetch(request) {
              return new Response(request.url, { headers: { 'x-handler': 'api' } });
            }};
          `,
          }))
        },
      },
    ],
  })
  worker = (
    await import(
      `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
    )
  ).default
})

async function handler(path) {
  const request = new Request(`https://rhyme.sachi.dev${path}`)
  const response = await worker.fetch(
    request,
    {
      ASSETS: {
        fetch(request) {
          return new Response(request.url, {
            headers: { 'x-handler': 'assets' },
          })
        },
      },
    },
    {},
  )
  assert.equal(await response.text(), request.url)
  return response.headers.get('x-handler')
}

test('OAuth completion URLs serve the frontend and preserve redirect parameters', async () => {
  for (const path of [
    '/auth/complete?redirect=%2Ffiles',
    '/auth/complete/',
    '/auth/complete.html?redirect=%2Ffiles',
    '/auth/complete.html/',
  ])
    assert.equal(await handler(path), 'assets', path)
})

test('auth endpoints and OAuth callbacks still reach the API', async () => {
  for (const path of [
    '/auth/get-session',
    '/auth/sign-in/social',
    '/auth/sign-in/email-otp',
    '/auth/callback/google?code=fixture&state=fixture',
    '/auth/callback/github?code=fixture&state=fixture',
    '/auth/complete/other',
    '/auth/complete-other',
  ])
    assert.equal(await handler(path), 'api', path)
})

test('policy pages and workspace URLs serve assets while binary and tRPC endpoints reach the API', async () => {
  for (const path of [
    '/privacy',
    '/terms',
    '/sign-in',
    '/files',
    '/files/fixture',
  ])
    assert.equal(await handler(path), 'assets', path)
  for (const path of [
    '/trpc/files.list',
    '/profile/pictures/user/picture',
    '/files/fixture/thumbnail',
    '/files/fixture/agent/chat',
    '/files/fixture/assets/image',
    '/assets/00000000-0000-4000-8000-000000000001',
  ])
    assert.equal(await handler(path), 'api', path)
})
