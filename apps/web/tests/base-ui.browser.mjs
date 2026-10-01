import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { chromium } from 'playwright'

let server, browser, page, origin
const errors = []

before(async () => {
  server = await createServer({
    root: new URL('../', import.meta.url).pathname,
    configFile: false,
    cacheDir: 'node_modules/.vite-ui-tests',
    appType: 'custom',
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwind(),
      react(),
      {
        name: 'component-fixture',
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (request.url !== '/') return next()
            response.setHeader('Content-Type', 'text/html')
            response.end(
              await vite.transformIndexHtml(
                '/',
                '<html><head></head><body><div id="root"></div><script type="module" src="/tests/fixtures/base-ui.tsx"></script></body></html>',
              ),
            )
          })
        },
      },
    ],
    optimizeDeps: {
      entries: ['tests/fixtures/base-ui.tsx'],
      include: [
        'react',
        'react-dom/client',
        'react/jsx-runtime',
        '@rhyme/ui > @base-ui/react/alert-dialog',
        '@rhyme/ui > @base-ui/react/button',
        '@rhyme/ui > @base-ui/react/dialog',
        '@rhyme/ui > @base-ui/react/input',
        '@rhyme/ui > @base-ui/react/menu',
        '@rhyme/ui > @base-ui/react/merge-props',
        '@rhyme/ui > @base-ui/react/popover',
        '@rhyme/ui > @base-ui/react/preview-card',
        '@rhyme/ui > @base-ui/react/scroll-area',
        '@rhyme/ui > @base-ui/react/select',
        '@rhyme/ui > @base-ui/react/separator',
        '@rhyme/ui > @base-ui/react/switch',
        '@rhyme/ui > @base-ui/react/toast',
        '@rhyme/ui > @base-ui/react/tooltip',
        '@rhyme/ui > @base-ui/react/use-render',
        '@rhyme/ui > class-variance-authority',
        '@rhyme/ui > cn',
        'lucide-react',
      ],
    },
    server: { port: 0, host: '127.0.0.1', hmr: false, ws: false },
  })
  await server.listen()
  origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  })
})

beforeEach(async () => {
  await page?.close()
  errors.length = 0
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } })
  page.setDefaultTimeout(5000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin)
  await page.getByRole('button', { name: 'File options' }).waitFor()
})

after(async () => {
  await browser?.close()
  await server?.close()
})

async function openMenuDialog(item) {
  await page.getByRole('button', { name: 'File options' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('popover dismisses outside and with Escape, returning trigger focus', async () => {
  const trigger = page.getByRole('button', { name: 'Context', exact: true })
  await trigger.click()
  const popup = page.locator('[data-slot="popover-content"]')
  await popup.waitFor()
  await page
    .getByRole('link', { name: 'Open context', exact: true })
    .press('Escape')
  await popup.waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Context',
  )
  await trigger.click()
  await popup.waitFor()
  await page.mouse.click(10, 10)
  await popup.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
})

test('preview card opens on hover and closes after pointer leaves', async () => {
  await page
    .getByRole('link', { name: 'Conversation preview', exact: true })
    .hover()
  const preview = page.locator('[data-slot="hover-card-content"]')
  await preview.waitFor()
  assert.equal(await preview.innerText(), 'Preview details')
  await page.mouse.move(10, 10)
  await preview.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
})

test('switch toggles with click and Space using accessible checked state', async () => {
  const toggle = page.getByRole('switch', { name: 'Grid', exact: true })
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-checked'), 'true')
  await toggle.press('Space')
  assert.equal(await toggle.getAttribute('aria-checked'), 'false')
  assert.deepEqual(errors, [])
})

test('keyboard submenu radio selection closes all menu layers and returns focus', async () => {
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Theme', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  const viewer = page.getByRole('menuitemradio', {
    name: 'Viewer',
    exact: true,
  })
  await viewer.waitFor()
  await viewer.focus()
  await page.keyboard.press('Enter')
  await page
    .getByRole('menu', { name: 'Preferences', exact: true })
    .waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Preferences',
  )
  assert.equal(
    await page.getByRole('combobox', { name: 'Permission' }).innerText(),
    'Viewer',
  )
  assert.deepEqual(errors, [])
})

test('select resolves its label before opening and updates using keyboard selection', async () => {
  const select = page.getByRole('combobox', { name: 'Permission' })
  assert.equal(await select.innerText(), 'Editor')
  await select.click()
  await page.getByRole('option', { name: 'Viewer', exact: true }).click()
  await page.getByRole('listbox').waitFor({ state: 'hidden' })
  assert.equal(await select.innerText(), 'Viewer')
  await select.focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('listbox').waitFor()
  await page.waitForFunction(() =>
    document
      .querySelector('[data-slot="select-content"]')
      ?.contains(document.activeElement),
  )
  await page.keyboard.press('End')
  await page.waitForFunction(() =>
    document
      .querySelector('[role="option"][data-highlighted]')
      ?.textContent.includes('Editor'),
  )
  await page.keyboard.press('Enter')
  await page.getByRole('listbox').waitFor({ state: 'hidden' })
  assert.equal(await select.innerText(), 'Editor')
  assert.deepEqual(errors, [])
})

test('tooltip and dropdown share one button and open a rename dialog with focused input', async () => {
  const trigger = page.getByRole('button', { name: 'File options' })
  assert.equal(await trigger.count(), 1)
  assert.equal(await trigger.locator('button').count(), 0)
  await trigger.hover()
  const tooltip = page.locator('[data-slot="tooltip-content"]')
  await tooltip.waitFor()
  assert.match(await tooltip.innerText(), /Manage this file/)
  await openMenuDialog('Rename file')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT')
  const input = dialog.getByRole('textbox')
  assert.equal(await input.inputValue(), 'Original name')
  await input.fill('Updated name')
  await input.press('Enter')
  await dialog.waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'File options',
  )
  assert.equal(await page.getByTestId('file-name').innerText(), 'Updated name')
  await openMenuDialog('Rename file')
  await page.getByRole('dialog').waitFor()
  await page.mouse.click(10, 10)
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
})

test('confirmation survives outside clicks, cancellation, async failure and pending Escape', async () => {
  await openMenuDialog('Delete file')
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor()
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Cancel',
  )
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    'Cancel',
  )
  await page.mouse.click(10, 10)
  assert.equal(await dialog.isVisible(), true)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByTestId('completed').innerText(), '0')
  await openMenuDialog('Delete file')
  const confirm = dialog.getByRole('button', { name: 'Delete permanently' })
  await confirm.click()
  assert.equal(await confirm.isDisabled(), true)
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Cancel', exact: true })
      .isDisabled(),
    true,
  )
  await page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), true)
  await page.evaluate(() => window.failConfirmation())
  await dialog.getByRole('alert').waitFor()
  assert.equal(await dialog.getByRole('alert').innerText(), 'Try again later')
  assert.equal(await confirm.isDisabled(), false)
  await confirm.click()
  await page.evaluate(() => window.completeConfirmation())
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByTestId('completed').innerText(), '1')
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'File options',
  )
  assert.deepEqual(errors, [])
})

test('toast Undo executes once and dismisses the toast', async () => {
  await page.getByRole('button', { name: 'Trash file' }).click()
  const toast = page.locator('[data-slot="toast"]')
  await toast.waitFor()
  assert.match(await toast.innerText(), /File moved to trash/)
  await toast.getByRole('button', { name: 'Undo', exact: true }).click()
  await toast.waitFor({ state: 'hidden' })
  assert.equal(await page.getByTestId('undone').innerText(), '1')
  assert.deepEqual(errors, [])
})

test('scroll viewport stays constrained and its custom scrollbar responds to overflow', async () => {
  const area = page.locator('[data-slot="scroll-area"]')
  const viewport = page.locator('[data-slot="scroll-area-viewport"]')
  const rootBox = await area.boundingBox()
  const viewportBox = await viewport.boundingBox()
  assert.equal(rootBox.height, 128)
  assert.equal(rootBox.width, 256)
  assert.equal(viewportBox.height, rootBox.height)
  assert.equal(viewportBox.width, rootBox.width)
  const heights = await viewport.evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
  }))
  assert.ok(heights.scroll > heights.client)
  await area.hover()
  const scrollbar = page.locator('[data-slot="scroll-area-scrollbar"]')
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector('[data-slot="scroll-area-scrollbar"]'),
      ).opacity === '1',
  )
  assert.equal((await scrollbar.boundingBox()).width, 8)
  await viewport.evaluate((element) => {
    element.scrollTop = 500
  })
  assert.equal(await viewport.evaluate((element) => element.scrollTop), 500)
  assert.deepEqual(errors, [])
})

test('rendered breadcrumb and active sidebar links retain children and link semantics', async () => {
  const breadcrumb = page.getByRole('link', { name: 'Workspace breadcrumb' })
  const sidebar = page.getByRole('link', { name: 'Workspace navigation' })
  assert.equal(await breadcrumb.getAttribute('href'), '#breadcrumbs')
  assert.equal(await sidebar.getAttribute('href'), '#sidebar')
  assert.equal(await sidebar.getAttribute('role'), null)
  assert.equal(await sidebar.getAttribute('aria-label'), 'Workspace navigation')
  assert.notEqual(await sidebar.getAttribute('data-active'), null)
  const styles = await sidebar.evaluate((element) => ({
    weight: getComputedStyle(element).fontWeight,
    background: getComputedStyle(element).backgroundColor,
  }))
  assert.equal(styles.weight, '400')
  assert.notEqual(styles.background, 'rgba(0, 0, 0, 0)')
  assert.equal(await sidebar.locator('button').count(), 0)
  assert.deepEqual(errors, [])
})

test('select portal works inside a modal dialog and Escape closes each layer in order', async () => {
  const trigger = page.getByRole('button', { name: 'Manage permission' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  const select = dialog.getByRole('combobox', { name: 'Dialog permission' })
  assert.equal(await select.innerText(), 'Editor')
  await select.click()
  await page.getByRole('option', { name: 'Viewer', exact: true }).click()
  assert.equal(await dialog.isVisible(), true)
  assert.equal(await select.innerText(), 'Viewer')
  await select.click()
  await page.getByRole('listbox').waitFor()
  await page.waitForFunction(() =>
    document
      .querySelector('[data-slot="select-content"]')
      ?.contains(document.activeElement),
  )
  await page.keyboard.press('Escape')
  await page.getByRole('listbox').waitFor({ state: 'hidden' })
  assert.equal(await dialog.isVisible(), true)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Manage permission',
  )
  assert.deepEqual(errors, [])
})

test('menu finalFocus moves focus to the composer textarea after a suggestion', async () => {
  await page.getByRole('button', { name: 'Example prompts' }).click()
  await page.getByRole('menuitem', { name: 'Flowchart', exact: true }).click()
  const textarea = page.getByRole('textbox', { name: 'Canvas prompt' })
  await page.waitForFunction(
    () => document.activeElement?.tagName === 'TEXTAREA',
  )
  assert.equal(await textarea.inputValue(), 'Draw a flowchart')
  assert.deepEqual(errors, [])
})

test('mobile sheet opens at the correct size, dismisses outside and restores trigger focus', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  await trigger.click()
  const sheet = page.getByRole('dialog')
  await sheet.waitFor()
  assert.match(await sheet.innerText(), /Mobile navigation/)
  const box = await sheet.boundingBox()
  assert.equal(box.height, 844)
  assert.equal(box.width, 292.5)
  await page.mouse.click(380, 400)
  await sheet.waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Open navigation',
  )
  await trigger.click()
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await sheet.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
})

test('brand colors and button dimensions remain consistent in light and dark modes', async () => {
  const button = page.getByRole('button', { name: 'Trash file' })
  await page.mouse.move(1000, 700)
  assert.equal((await button.boundingBox()).height, 32)
  assert.equal(
    await button.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
    'rgb(117, 100, 143)',
  )
  if (process.env.UI_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.UI_SCREENSHOT_DIR}/base-ui-desktop-light.png`,
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('button[data-slot="button"]'))
        .backgroundColor === 'rgb(196, 182, 218)',
  )
  assert.equal((await button.boundingBox()).height, 32)
  assert.equal(
    await button.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
    'rgb(196, 182, 218)',
  )
  if (process.env.UI_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.UI_SCREENSHOT_DIR}/base-ui-mobile-dark.png`,
      fullPage: true,
    })
  }
  assert.deepEqual(errors, [])
})
