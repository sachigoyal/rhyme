import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'))
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare')
const { build } = wranglerRequire('esbuild')
const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const webOrigin = 'http://localhost:3000'
const apiOrigin = 'http://localhost:8787'
let runtime, db, identity, receiveEmail

const providerFixture = async (request) => {
  const url = new URL(request.url)
  if (url.hostname === 'mail.fixture') {
    receiveEmail(await request.json())
    return Response.json({ success: true })
  }
  if (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') {
    const payload = Buffer.from(
      JSON.stringify({
        sub: String(identity.id),
        email: identity.email,
        email_verified: identity.verified,
        name: identity.name,
        picture: identity.image,
      }),
    ).toString('base64url')
    return Response.json({
      access_token: 'fixture-google-token',
      token_type: 'Bearer',
      id_token: `eyJhbGciOiJub25lIn0.${payload}.fixture`,
      scope: 'openid email profile',
    })
  }
  if (
    url.hostname === 'github.com' &&
    url.pathname === '/login/oauth/access_token'
  )
    return Response.json({
      access_token: 'fixture-github-token',
      token_type: 'Bearer',
      scope: 'read:user,user:email',
    })
  if (url.hostname === 'api.github.com' && url.pathname === '/user')
    return Response.json({
      id: identity.id,
      login: 'fixture-user',
      name: identity.name,
      email: null,
      avatar_url: identity.image,
    })
  if (url.hostname === 'api.github.com' && url.pathname === '/user/emails')
    return Response.json([
      { email: identity.email, primary: true, verified: identity.verified },
    ])
  throw new Error(`Unexpected provider request: ${url.origin}${url.pathname}`)
}

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { createAuth } from './src/lib/auth';
        import { createDb } from '@rhyme/db';
        export default { fetch(request, env, ctx) {
          const missing = request.headers.get('x-missing-credential');
          const authEnv = {
            ...env,
            ...(missing ? { [missing]: undefined } : {}),
            EMAIL: { send: (message) => fetch('https://mail.fixture/send', { method: 'POST', body: JSON.stringify(message) }) },
          };
          return createAuth({ env: authEnv, db: createDb(env.DB), waitUntil: (promise) => ctx.waitUntil(promise) }).handler(request);
        }};
      `,
      resolveDir: root,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*', 'cloudflare:*'],
  })
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: result.outputFiles[0].text,
      compatibilityDate: '2026-09-01',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      bindings: {
        API_URL: apiOrigin,
        WEB_URL: webOrigin,
        BETTER_AUTH_SECRET: 'fixture-auth-secret-'.repeat(3),
        GOOGLE_CLIENT_ID: 'fixture-google-client',
        GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
        GITHUB_CLIENT_ID: 'fixture-github-client',
        GITHUB_CLIENT_SECRET: 'fixture-github-secret',
      },
      outboundService: providerFixture,
    }),
  )
  db = (await runtime.getBindings()).DB
  const sql = await readFile(
    resolve(root, '../../packages/db/migrations/0000_init.sql'),
    'utf8',
  )
  await db.exec(
    sql.replaceAll('--> statement-breakpoint', '').replaceAll('\n', ' '),
  )
})
after(async () => runtime?.dispose())

function signIn(provider, missingCredential, callbackURL) {
  return runtime.dispatchFetch(`${apiOrigin}/auth/sign-in/social`, {
    method: 'POST',
    headers: {
      origin: webOrigin,
      'content-type': 'application/json',
      ...(missingCredential
        ? { 'x-missing-credential': missingCredential }
        : {}),
    },
    body: JSON.stringify({
      provider,
      callbackURL:
        callbackURL ?? `${webOrigin}/auth/complete?redirect=%2Ffiles`,
      newUserCallbackURL: `${webOrigin}/auth/complete?redirect=%2Ffiles`,
      errorCallbackURL: `${webOrigin}/sign-in?redirect=%2Ffiles`,
      disableRedirect: true,
    }),
  })
}

for (const provider of ['google', 'github']) {
  test(`${provider} uses the configured client, callback and identity scopes`, async () => {
    const response = await signIn(provider)
    assert.equal(response.status, 200)
    const data = await response.json()
    const url = new URL(data.url)
    assert.equal(
      url.hostname,
      provider === 'google' ? 'accounts.google.com' : 'github.com',
    )
    assert.equal(
      url.searchParams.get('client_id'),
      `fixture-${provider}-client`,
    )
    assert.equal(
      url.searchParams.get('redirect_uri'),
      `${apiOrigin}/auth/callback/${provider}`,
    )
    assert.ok(url.searchParams.get('state'))
    assert.ok(
      url.searchParams
        .get('scope')
        .includes(provider === 'google' ? 'email' : 'user:email'),
    )
    assert.equal(data.url.includes(`fixture-${provider}-secret`), false)

    const canceled = await runtime.dispatchFetch(
      `${apiOrigin}/auth/callback/${provider}?error=access_denied&state=${url.searchParams.get('state')}`,
      {
        redirect: 'manual',
        headers: {
          cookie: response.headers
            .getSetCookie()
            .map((cookie) => cookie.split(';')[0])
            .join('; '),
        },
      },
    )
    assert.equal(canceled.status, 302)
    const retry = new URL(canceled.headers.get('location'))
    assert.equal(retry.origin, webOrigin)
    assert.equal(retry.pathname, '/sign-in')
    assert.equal(retry.searchParams.get('redirect'), '/files')
    assert.equal(retry.searchParams.get('error'), 'access_denied')
  })

  for (const field of ['CLIENT_ID', 'CLIENT_SECRET']) {
    test(`${provider} requires ${field} before enabling sign-in`, async () => {
      const response = await signIn(
        provider,
        `${provider.toUpperCase()}_${field}`,
      )
      assert.equal(response.status, 404)
      assert.equal((await response.json()).code, 'PROVIDER_NOT_FOUND')
    })
  }
}

test('social sign-in rejects an external completion destination', async () => {
  const response = await signIn(
    'google',
    undefined,
    'https://untrusted.example/finish',
  )
  assert.equal(response.status, 403)
})

const cookies = (response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')

async function oauth(provider, profile) {
  identity = { verified: true, ...profile }
  const response = await signIn(provider)
  assert.equal(response.status, 200)
  const url = new URL((await response.json()).url)
  const callback = await runtime.dispatchFetch(
    `${apiOrigin}/auth/callback/${provider}?code=fixture-code&state=${url.searchParams.get('state')}`,
    { redirect: 'manual', headers: { cookie: cookies(response) } },
  )
  assert.equal(callback.status, 302)
  return callback
}

async function getSession(response) {
  const session = await runtime.dispatchFetch(`${apiOrigin}/auth/get-session`, {
    headers: { cookie: cookies(response) },
  })
  assert.equal(session.status, 200)
  return session.json()
}

async function emailSignIn(email) {
  const sent = new Promise((resolve) => {
    receiveEmail = resolve
  })
  const send = await runtime.dispatchFetch(
    `${apiOrigin}/auth/email-otp/send-verification-otp`,
    {
      method: 'POST',
      headers: { origin: webOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    },
  )
  assert.equal(send.status, 200)
  const message = await sent
  const otp = message.text.match(/\b\d{6}\b/)[0]
  const response = await runtime.dispatchFetch(
    `${apiOrigin}/auth/sign-in/email-otp`,
    {
      method: 'POST',
      headers: { origin: webOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    },
  )
  assert.equal(response.status, 200)
  return (await response.json()).user
}

for (const provider of ['google', 'github']) {
  test(`${provider} signup saves the provider avatar and verified email`, async () => {
    const email = `${provider}-new@example.test`
    const image = `https://avatars.example.test/${provider}.png`
    const response = await oauth(provider, {
      id: provider === 'google' ? 101 : 102,
      email,
      name: 'Provider Name',
      image,
    })
    assert.equal(
      new URL(response.headers.get('location')).pathname,
      '/auth/complete',
    )
    const session = await getSession(response)
    assert.equal(session.user.email, email)
    assert.equal(session.user.emailVerified, true)
    assert.equal(session.user.image, image)
    assert.equal((await emailSignIn(email)).id, session.user.id)
  })
}

test('email, Google, and GitHub share one user and preserve chosen profile details', async () => {
  const email = 'shared@example.test'
  const original = await emailSignIn('SHARED@example.test')
  await db
    .prepare('UPDATE users SET name = ? WHERE id = ?')
    .bind('Chosen Name', original.id)
    .run()
  const googleImage = 'https://avatars.example.test/google-shared.png'
  const google = await getSession(
    await oauth('google', {
      id: 201,
      email,
      name: 'Google Name',
      image: googleImage,
    }),
  )
  assert.equal(google.user.id, original.id)
  assert.equal(google.user.name, 'Chosen Name')
  assert.equal(google.user.image, googleImage)

  const customImage = 'https://rhyme.sachi.dev/profile/pictures/custom.png'
  await db
    .prepare('UPDATE users SET image = ? WHERE id = ?')
    .bind(customImage, original.id)
    .run()
  const github = await getSession(
    await oauth('github', {
      id: 202,
      email: 'SHARED@example.test',
      name: 'GitHub Name',
      image: 'https://avatars.example.test/github-shared.png',
    }),
  )
  assert.equal(github.user.id, original.id)
  assert.equal(github.user.name, 'Chosen Name')
  assert.equal(github.user.image, customImage)
  assert.equal((await emailSignIn(email)).id, original.id)
  const repeated = await getSession(
    await oauth('google', {
      id: 201,
      email,
      name: 'Google Name',
      image: googleImage,
    }),
  )
  assert.equal(repeated.user.id, original.id)
  assert.equal(repeated.user.image, customImage)
  const accounts = await db
    .prepare(
      'SELECT provider_id, user_id FROM accounts WHERE user_id = ? ORDER BY provider_id',
    )
    .bind(original.id)
    .all()
  assert.deepEqual(accounts.results, [
    { provider_id: 'github', user_id: original.id },
    { provider_id: 'google', user_id: original.id },
  ])
  const users = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .all()
  assert.deepEqual(users.results, [{ id: original.id }])
})

test('an unverified provider email cannot attach to an existing user', async () => {
  const email = 'verified-owner@example.test'
  const owner = await emailSignIn(email)
  const response = await oauth('github', {
    id: 301,
    email,
    name: 'Unverified',
    image: 'https://avatars.example.test/unverified.png',
    verified: false,
  })
  const redirect = new URL(response.headers.get('location'))
  assert.equal(redirect.pathname, '/sign-in')
  assert.equal(redirect.searchParams.get('error'), 'account_not_linked')
  const accounts = await db
    .prepare('SELECT id FROM accounts WHERE user_id = ?')
    .bind(owner.id)
    .all()
  assert.equal(accounts.results.length, 0)
  assert.equal(await getSession(response), null)
})
