import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { create } from 'fontkit'
import { Resvg } from '@resvg/resvg-js'
import { seoPages } from '../src/lib/seo.ts'
import {
  brandMarkPath,
  brandWordmarkDotPath,
  brandWordmarkPath,
} from '../src/components/brand.ts'

const fontData = await readFile(new URL('./fonts/Geist.ttf', import.meta.url))
const regular = create(fontData).getVariation({ wght: 400 })
const medium = create(fontData).getVariation({ wght: 550 })
const ink = '#262626'
const muted = '#737373'
const primary = '#75648f'
const tint = '#eeeaf4'
const border = '#e5e5e5'

function text(value, x, y, size = 18, color = ink, bold = false) {
  const font = bold ? medium : regular
  const run = font.layout(value)
  const scale = size / font.unitsPerEm
  let advance = 0
  const paths = run.glyphs
    .map((glyph, i) => {
      const position = run.positions[i]
      const path = `<path d="${glyph.path.toSVG()}" transform="translate(${(advance + position.xOffset) * scale} ${-position.yOffset * scale}) scale(${scale} ${-scale})"/>`
      advance += position.xAdvance
      return path
    })
    .join('')
  return `<g fill="${color}" transform="translate(${x} ${y})">${paths}</g>`
}

function rect(x, y, w, h, fill = '#ffffff', stroke = border, radius = 12) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
}

function line(x1, y1, x2, y2, color = border, width = 2) {
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`
}

function diagram() {
  return [
    rect(0, 0, 376, 332),
    text('Canvas', 22, 33, 16, ink, true),
    line(0, 52, 376, 52),
    `<g stroke="${primary}" stroke-width="2" fill="none"><path d="M188 132V157H86V183M188 157H290V183"/><path d="M81 177L86 183L91 177M285 177L290 183L295 177"/></g>`,
    rect(127, 84, 122, 48, tint, primary, 8),
    text('Project', 158, 114, 18, primary, true),
    rect(30, 184, 112, 48, '#fff', border, 8),
    text('Design', 56, 214, 17),
    rect(234, 184, 112, 48, '#fff', border, 8),
    text('Build', 271, 214, 17),
    rect(97, 273, 182, 40, '#fff', border, 8),
    rect(105, 281, 24, 24, primary, primary, 5),
    `<path d="M113 286L113 298L117 295L121 299" fill="none" stroke="white" stroke-width="1.6"/>`,
    ...[148, 181, 214, 247].map((x, i) =>
      i % 2
        ? `<circle cx="${x}" cy="293" r="6" fill="none" stroke="${muted}" stroke-width="1.5"/>`
        : rect(x - 6, 287, 12, 12, '#fff', muted, 1),
    ),
  ].join('')
}

function canvases(id) {
  const heading =
    id === 'shared' ? 'Shared with me' : id === 'trash' ? 'Trash' : 'Canvases'
  return [
    rect(0, 0, 376, 332),
    text(heading, 22, 35, 18, ink, true),
    line(0, 55, 376, 55),
    rect(20, 74, 336, 31, '#fafafa', border, 6),
    text('Search canvases', 36, 95, 13, muted),
    ...[0, 1, 2, 3].map((i) => {
      const x = 20 + (i % 2) * 176
      const y = 127 + Math.floor(i / 2) * 94
      return (
        rect(x, y, 160, 78) +
        rect(
          x + 20,
          y + 18,
          38,
          24,
          i === 0 ? tint : '#fafafa',
          i === 0 ? primary : border,
          3,
        ) +
        line(x + 58, y + 30, x + 112, y + 30, muted, 1.5) +
        rect(x + 111, y + 21, 25, 18, '#fff', border, 3) +
        line(x + 14, y + 63, x + 70, y + 63, border, 3)
      )
    }),
    id === 'trash'
      ? text('Restore', 22, 316, 14, primary, true)
      : id === 'shared'
        ? text('Viewer and editor access', 22, 316, 13, muted)
        : text('Folders', 22, 316, 13, muted),
  ].join('')
}

function signIn() {
  return [
    rect(0, 0, 376, 332),
    text('Sign in to Rhyme', 28, 62, 25, ink, true),
    text('Email address', 28, 120, 15),
    rect(28, 136, 320, 48, '#fff', border, 7),
    text('you@example.com', 43, 166, 16, muted),
    rect(28, 202, 320, 46, primary, primary, 7),
    text('Continue with email', 47, 231, 16, '#fff', true),
    text('Email verification code', 28, 285, 14, muted),
  ].join('')
}

function profile() {
  return [
    rect(0, 0, 376, 332),
    text('Account setup', 26, 44, 18, ink, true),
    line(26, 64, 350, 64),
    text('Your name', 26, 114, 23, ink, true),
    rect(26, 137, 324, 44, '#fff', border, 7),
    text('Name', 40, 165, 15, muted),
    text('Your role', 26, 218, 15),
    rect(26, 236, 153, 40, tint, primary, 7),
    text('Design', 70, 261, 15, primary),
    rect(195, 236, 155, 40, '#fff', border, 7),
    text('Engineering', 224, 261, 15),
    ...[0, 1, 2, 3, 4, 5].map((i) =>
      line(27 + i * 55, 307, 65 + i * 55, 307, i === 0 ? primary : border, 4),
    ),
  ].join('')
}

function conversations() {
  return [
    rect(0, 0, 376, 332),
    text('Canvas assistant', 22, 35, 18, ink, true),
    line(0, 55, 376, 55),
    rect(138, 82, 216, 44, tint, tint, 9),
    text('Create a flowchart', 157, 109, 16),
    rect(22, 151, 272, 75, '#fafafa', border, 9),
    text('Created 3 shapes', 39, 178, 16, ink, true),
    text('View canvas changes', 39, 207, 14, muted),
    rect(22, 261, 332, 48, '#fff', border, 9),
    text('Describe a change…', 37, 291, 15, muted),
    `<circle cx="329" cy="285" r="12" fill="${primary}"/><path d="M325 286L329 282L333 286M329 282V290" fill="none" stroke="white" stroke-width="1.5"/>`,
  ].join('')
}

function activity() {
  const labels = ['Agent runs', 'Canvas actions', 'Tokens used', 'Run time']
  return [
    rect(0, 0, 376, 332),
    text('Agent activity', 22, 35, 18, ink, true),
    line(0, 55, 376, 55),
    ...labels.map((label, i) => {
      const x = 20 + (i % 2) * 176
      const y = 78 + Math.floor(i / 2) * 110
      return (
        rect(x, y, 160, 93) +
        text(label, x + 14, y + 26, 13, muted) +
        text('—', x + 14, y + 67, 30, i === 0 ? primary : ink)
      )
    }),
    text('7 days', 23, 314, 12, muted),
    rect(96, 293, 76, 31, tint, tint, 6),
    text('30 days', 112, 313, 12, primary),
    text('90 days', 188, 314, 12, muted),
  ].join('')
}

function notFound() {
  return [
    `<rect x="65" y="42" width="246" height="230" rx="10" stroke="${border}" stroke-width="2" stroke-dasharray="7 8" fill="white"/>`,
    text('404', 104, 183, 76, primary, true),
    ...[
      [65, 42],
      [311, 42],
      [65, 272],
      [311, 272],
    ].map(([x, y]) => rect(x - 5, y - 5, 10, 10, '#fff', primary, 1)),
    text('Page not found', 119, 318, 18, muted),
  ].join('')
}

function illustration(id) {
  if (id === 'sign-in') return signIn()
  if (id === 'onboarding') return profile()
  if (id === 'activity') return activity()
  if (id === 'conversations') return conversations()
  if (id === 'not-found') return notFound()
  if (['canvases', 'shared', 'trash', 'auth-complete'].includes(id))
    return canvases(id)
  return diagram()
}

function imageSvg(page) {
  const size = page.imageTitle.some((line) => line.length > 24) ? 42 : 54
  const titleY = page.imageTitle.length > 1 ? 272 : 302
  const descriptionWords = page.imageDescription.split(' ')
  const descriptionLines = ['']
  for (const word of descriptionWords) {
    const i = descriptionLines.length - 1
    if ((descriptionLines[i] + word).length > 46) descriptionLines.push(word)
    else descriptionLines[i] += `${descriptionLines[i] ? ' ' : ''}${word}`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#ffffff"/>
    <g transform="translate(64 64) scale(1.35)"><path d="${brandMarkPath}" fill="${primary}"/></g>
    <g transform="translate(118 63) scale(1.14)"><path d="${brandWordmarkPath}" fill="${ink}" fill-rule="evenodd"/><path d="${brandWordmarkDotPath}" fill="${primary}"/></g>
    ${page.imageTitle.map((line, i) => text(line, 64, titleY + i * 65, size, ink, true)).join('')}
    ${descriptionLines.map((line, i) => text(line, 67, titleY + page.imageTitle.length * 65 + 14 + i * 29, 21, muted)).join('')}
    <g transform="translate(760 158)">${illustration(page.id)}</g>
    ${line(64, 550, 1136, 550)}
    ${text('Rhyme', 64, 584, 16, muted)}
    ${text('Online whiteboard · Canvas assistant', 814, 584, 15, muted)}
  </svg>`
}

const output = new URL('../public/og/', import.meta.url)
await mkdir(output, { recursive: true })
for (const page of Object.values(seoPages)) {
  const svg = imageSvg(page)
  const png = new Resvg(svg, { font: { loadSystemFonts: false } })
    .render()
    .asPng()
  await Promise.all([
    writeFile(new URL(`${page.id}.png`, output), png),
    writeFile(new URL(`${page.id}.svg`, output), svg),
  ])
  process.stdout.write(
    `${page.id}: 1200 × 630, ${Math.ceil(png.length / 1024)} KB\n`,
  )
}
await writeFile(
  new URL('FONT-LICENSE.txt', output),
  await readFile(new URL('./fonts/OFL.txt', import.meta.url)),
)
