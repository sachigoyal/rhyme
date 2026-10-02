import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canIndexSite,
  createSeoHead,
  getSeoPage,
  normalizeSiteUrl,
  seoPages,
} from '../src/lib/seo.ts'
import { robotsTxt, sitemapXml } from '../scripts/seo-assets.ts'

const origin = 'https://seo-check.rhyme.invalid'
const meta = (head, key) =>
  head.meta.find((entry) => entry.name === key || entry.property === key)
    ?.content

test('the whiteboard and policy pages are indexable while workspace routes stay private', () => {
  const publicPages = new Set(['home', 'privacy', 'terms'])
  for (const page of Object.values(seoPages)) {
    const head = createSeoHead(page, origin)
    assert.equal(
      meta(head, 'robots').startsWith('index,'),
      publicPages.has(page.id),
    )
    assert.equal(head.links.length, publicPages.has(page.id) ? 1 : 0)
    if (publicPages.has(page.id))
      assert.equal(head.links[0].href, new URL(page.path, origin).href)
    assert.equal(
      head.meta.some((entry) => 'script:ld+json' in entry),
      page.id === 'home',
    )
  }
  const sitemap = sitemapXml(origin)
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, 3)
  assert.ok(sitemap.includes(`${origin}/</loc>`))
  assert.ok(sitemap.includes(`${origin}/privacy</loc>`))
  assert.ok(sitemap.includes(`${origin}/terms</loc>`))
  assert.ok(robotsTxt(origin).includes(`Sitemap: ${origin}/sitemap.xml`))
})

test('development and explicitly disabled preview builds cannot be indexed', () => {
  for (const url of [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ]) {
    assert.equal(canIndexSite(url), false)
    assert.equal(
      meta(createSeoHead(seoPages.home, url), 'robots'),
      'noindex, follow',
    )
    assert.equal(robotsTxt(url), 'User-agent: *\nDisallow: /\n')
    assert.equal(sitemapXml(url).includes('<loc>'), false)
  }
  assert.equal(canIndexSite(origin, false), false)
  assert.equal(
    meta(createSeoHead(seoPages.home, origin, false), 'robots'),
    'noindex, follow',
  )
})

test('workspace variants have distinct previews without exposing query data or canvas identities', () => {
  assert.equal(getSeoPage('/files?view=shared&folder=private-id').id, 'shared')
  assert.equal(getSeoPage('/files?view=trash').id, 'trash')
  assert.equal(getSeoPage('/files?view=mine').id, 'canvases')
  assert.equal(getSeoPage('/files/private-id?chat=secret-id').id, 'canvas')
  assert.equal(getSeoPage('/files/private-id/unknown').id, 'not-found')
  assert.equal(getSeoPage('/unknown').id, 'not-found')
  assert.equal(getSeoPage('/sign-in/').id, 'sign-in')
  const head = createSeoHead(
    getSeoPage('/files/private-id?chat=secret-id'),
    origin,
  )
  assert.equal(JSON.stringify(head).includes('private-id'), false)
  assert.equal(JSON.stringify(head).includes('secret-id'), false)
})

test('social cards use complete absolute URLs and one value for each metadata key', () => {
  for (const page of Object.values(seoPages)) {
    const head = createSeoHead(page, origin)
    const keys = head.meta.flatMap(
      (entry) => entry.name ?? entry.property ?? [],
    )
    assert.equal(new Set(keys).size, keys.length)
    for (const key of [
      'og:url',
      'og:image',
      'og:image:secure_url',
      'twitter:image',
    ]) {
      assert.equal(new URL(meta(head, key)).origin, origin)
    }
    assert.equal(meta(head, 'og:image:width'), '1200')
    assert.equal(meta(head, 'og:image:height'), '630')
    assert.ok(meta(head, 'og:image:alt'))
    assert.equal(meta(head, 'twitter:card'), 'summary_large_image')
    assert.equal(meta(head, 'og:description'), meta(head, 'description'))
  }
})

test('site origins reject credentials, insecure public URLs, paths, and query strings', () => {
  assert.equal(normalizeSiteUrl(`${origin}/`), origin)
  for (const value of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/app',
    'https://example.com?x=1',
    'javascript:alert(1)',
  ]) {
    assert.throws(() => normalizeSiteUrl(value))
  }
})
