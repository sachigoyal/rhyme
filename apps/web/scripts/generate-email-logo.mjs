import { readFile, writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

const source = await readFile(
  new URL('../public/brand/rhyme-logo.svg', import.meta.url),
  'utf8',
)
const png = new Resvg(source, {
  background: '#ffffff',
  fitTo: { mode: 'width', value: 330 },
})
  .render()
  .asPng()
await writeFile(
  new URL('../../api/src/emails/brand.ts', import.meta.url),
  `// Generated from the product logo by pnpm --filter web generate:email-logo.\nexport const emailLogo = '${png.toString('base64')}'\n`,
)
