import { readFile, writeFile } from 'node:fs/promises'
import {
  brandMarkPath,
  brandWordmarkDotPath,
  brandWordmarkPath,
  brandWordmarkViewBox,
} from '../src/components/brand.ts'

const css = await readFile(
  new URL('../../../packages/ui/src/styles/globals.css', import.meta.url),
  'utf8',
)
const color = (selector, token) => {
  const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0]
  const value = block.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]
  if (!value) throw new Error(`Missing ${selector} ${token} theme color`)
  return value
}
const style = `<style>.word{fill:${color(':root', 'foreground')}}.accent{fill:${color(':root', 'primary')}}@media(prefers-color-scheme:dark){.word{fill:${color('.dark', 'foreground')}}.accent{fill:${color('.dark', 'primary')}}}</style>`
const wordmark = `<path class="word" d="${brandWordmarkPath}" fill-rule="evenodd"/><path class="accent" d="${brandWordmarkDotPath}"/>`
const mark = `<path class="accent" d="${brandMarkPath}"/>`
const width = Number(brandWordmarkViewBox.split(' ')[2])
const svg = (viewBox, label, content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${style}${content}</svg>\n`
const assets = {
  'brand/rhyme-logo.svg': svg(
    `0 0 ${width + 50} 40`,
    'Rhyme',
    `<g transform="scale(1.25)">${mark}</g><g transform="translate(50)">${wordmark}</g>`,
  ),
  'brand/rhyme-wordmark.svg': svg(brandWordmarkViewBox, 'Rhyme', wordmark),
  'brand/rhyme-mark.svg': svg('0 0 32 32', 'Rhyme symbol', mark),
  'favicon.svg': svg('0 0 32 32', 'Rhyme symbol', mark),
}
for (const [file, content] of Object.entries(assets)) {
  await writeFile(new URL(`../public/${file}`, import.meta.url), content)
}
