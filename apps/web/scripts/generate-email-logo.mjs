import { readFile, writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

const source = await readFile(
  new URL('../public/brand/rhyme-logo.svg', import.meta.url),
  'utf8',
)
const styles = source.match(/<style>(.*?)<\/style>/s)[1]
const light = styles.split('@media')[0]
const dark = styles.match(/@media[^{}]+\{(.*)\}$/s)[1]
const render = (style, background) =>
  new Resvg(source.replace(/<style>.*?<\/style>/s, `<style>${style}</style>`), {
    background,
    fitTo: { mode: 'width', value: 330 },
  })
    .render()
    .asPng()
const png = render(light, '#ffffff')
const darkPng = render(dark, '#171717')
await writeFile(
  new URL('../../api/src/emails/brand.ts', import.meta.url),
  `// Generated from the product logo by pnpm --filter web generate:email-logo.\nexport const emailLogo =\n  '${png.toString('base64')}'\nexport const emailLogoDark =\n  '${darkPng.toString('base64')}'\n`,
)
