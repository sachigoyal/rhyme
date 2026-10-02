import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { seoPages } from '../src/lib/seo.ts'

const outputs = {
  'index.html': 'home',
  'sign-in.html': 'signIn',
  'privacy.html': 'privacy',
  'terms.html': 'terms',
  'onboarding.html': 'onboarding',
  'auth/complete.html': 'authComplete',
  'files.html': 'files',
  'chats.html': 'chats',
  'activity.html': 'activity',
  'settings.html': 'settings',
  '_shell.html': 'canvas',
  '404.html': 'notFound',
}

for (const [file, key] of Object.entries(outputs)) {
  const html = await readFile(
    new URL(`../dist/client/${file}`, import.meta.url),
    'utf8',
  )
  const page = seoPages[key]
  const head = html.slice(0, html.indexOf('</head>'))
  assert.ok(
    head.includes(`<title>${page.title}</title>`),
    `${file}: incorrect title`,
  )
  assert.equal(
    (head.match(/<title>/g) ?? []).length,
    1,
    `${file}: duplicate title`,
  )
  const tags = [...head.matchAll(/<meta\b[^>]*>/g)]
    .map(([tag]) => {
      const key = tag.match(/(?:name|property)="([^"]+)"/)?.[1]
      const value = tag.match(/content="([^"]+)"/)?.[1]
      return [key, value]
    })
    .filter(([key]) => key)
  assert.equal(
    new Set(tags.map(([key]) => key)).size,
    tags.length,
    `${file}: duplicate metadata`,
  )
  const meta = Object.fromEntries(tags)
  assert.ok(
    meta['og:image'].includes(`/og/${page.id}.png`),
    `${file}: incorrect image`,
  )
  assert.ok(meta['og:image:alt'], `${file}: missing image description`)
  assert.equal(meta['twitter:card'], 'summary_large_image')
  assert.equal(meta['description'], meta['og:description'])
  assert.equal(meta['og:image:width'], '1200')
  assert.equal(meta['og:image:height'], '630')
  const canonical = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)]
  assert.equal(
    canonical.length,
    page.indexable ? 1 : 0,
    `${file}: incorrect canonical`,
  )
  if (!page.indexable)
    assert.equal(
      meta.robots,
      'noindex, follow',
      `${file}: private route must not be indexed`,
    )
  if (page.id === 'home')
    assert.match(
      html,
      /<h1\b[^>]*>Online whiteboard<\/h1>/,
      `${file}: missing public heading`,
    )
  if (page.id === 'not-found')
    assert.match(
      html,
      /<h1\b[^>]*>Page not found<\/h1>/,
      `${file}: missing error heading`,
    )
  if (page.id === 'privacy' || page.id === 'terms') {
    assert.match(
      html,
      page.id === 'privacy'
        ? /<h1\b[^>]*>Privacy policy<\/h1>/
        : /<h1\b[^>]*>Terms of Service<\/h1>/,
      `${file}: missing policy content`,
    )
  }
  process.stdout.write(`${file}: metadata verified\n`)
}

for (const page of Object.values(seoPages)) {
  const png = await readFile(
    new URL(`../dist/client/og/${page.id}.png`, import.meta.url),
  )
  assert.equal(
    png.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${page.id}: invalid PNG`,
  )
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)
  assert.ok(png.length < 300_000, `${page.id}: image is too large`)
}
process.stdout.write('All Open Graph images: 1200 × 630, under 300 KB\n')
