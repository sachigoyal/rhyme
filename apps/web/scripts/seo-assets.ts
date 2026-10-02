import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canIndexSite, normalizeSiteUrl, seoPages } from '../src/lib/seo.ts'

export const seoPrerenderPages = [
  '/',
  '/sign-in',
  '/privacy',
  '/terms',
  '/onboarding',
  '/auth/complete',
  '/files',
  '/chats',
  '/activity',
  '/settings',
].map((path) => ({
  path,
  sitemap: { exclude: !['/', '/privacy', '/terms'].includes(path) },
  prerender: {
    headers:
      path === '/privacy' || path === '/terms'
        ? undefined
        : { 'X-TSS_SHELL': 'true' },
    crawlLinks: false,
    outputPath: path === '/' ? '/index.html' : `${path}.html`,
  },
}))

export function robotsTxt(siteUrl: string, allowIndexing = true) {
  const origin = normalizeSiteUrl(siteUrl)
  return canIndexSite(origin, allowIndexing)
    ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n'
}

export function sitemapXml(siteUrl: string, allowIndexing = true) {
  const origin = normalizeSiteUrl(siteUrl)
  const urls = canIndexSite(origin, allowIndexing)
    ? Object.values(seoPages)
        .filter((page) => 'indexable' in page && page.indexable)
        .map(
          (page) =>
            `  <url><loc>${new URL(page.path, origin).href}</loc></url>`,
        )
        .join('\n')
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function seoHeaders(siteUrl: string, allowIndexing = true) {
  const privatePaths = [
    '/files',
    '/files/*',
    '/chats',
    '/activity',
    '/settings',
    '/sign-in',
    '/onboarding',
    '/auth/*',
    '/not-found',
    '/404.html',
    '/_shell.html',
    '/_shell',
  ]
  const noindex = canIndexSite(siteUrl, allowIndexing) ? privatePaths : ['/*']
  return `${noindex.map((path) => `${path}\n  X-Robots-Tag: noindex, follow`).join('\n\n')}\n\n/og/*\n  Cache-Control: public, max-age=3600\n\n/brand/*\n  Cache-Control: public, max-age=3600\n`
}

export async function writeSeoAssets(
  output: string,
  siteUrl: string,
  allowIndexing = true,
) {
  await mkdir(output, { recursive: true })
  await Promise.all([
    writeFile(join(output, 'robots.txt'), robotsTxt(siteUrl, allowIndexing)),
    writeFile(join(output, 'sitemap.xml'), sitemapXml(siteUrl, allowIndexing)),
    writeFile(join(output, '_headers'), seoHeaders(siteUrl, allowIndexing)),
  ])
}
