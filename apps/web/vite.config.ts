import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seoPrerenderPages, writeSeoAssets } from './scripts/seo-assets.ts'
import { normalizeSiteUrl } from './src/lib/seo.ts'

export default defineConfig(({ mode }) => {
  const configEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = normalizeSiteUrl(
    configEnv.VITE_SITE_URL || 'http://localhost:3000',
  )
  const allowIndexing = configEnv.VITE_ALLOW_INDEXING !== 'false'
  return {
    resolve: { tsconfigPaths: true },
    server: { port: 3000 },
    plugins: [
      tailwindcss(),
      tanstackStart({
        spa: {
          enabled: true,
          maskPath: '/files/__shell',
          prerender: {
            onSuccess: () =>
              writeSeoAssets('dist/client', siteUrl, allowIndexing),
          },
        },
        prerender: { autoStaticPathsDiscovery: false, crawlLinks: false },
        pages: seoPrerenderPages,
      }),
      viteReact(),
    ],
  }
})
