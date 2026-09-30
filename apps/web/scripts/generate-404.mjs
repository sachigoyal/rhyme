import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

process.env.TSS_PRERENDERING = 'true'
const { default: server } = await import('../dist/server/server.js')
const response = await server.fetch(
  new Request('http://localhost/__rhyme_404__', {
    headers: { Accept: 'text/html' },
  }),
)
assert.equal(response.status, 404)
await writeFile(
  new URL('../dist/client/404.html', import.meta.url),
  await response.text(),
)
process.stdout.write('404.html: rendered from the root not-found boundary\n')
