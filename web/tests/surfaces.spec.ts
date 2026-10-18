import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { setupSurfaces, surfacePaths } from './surfaces-fixture'

const capture = process.env.SURFACE_CAPTURE
const mediaDir = resolve(process.env.SURFACE_CAPTURE_DIR || '../docs/screenshots/issue-128')
const views = ['today', 'day', 'upcoming']

async function ready(page: Page) {
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.getByText('Completare gli esercizi', { exact: false }).filter({ visible: true }).first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

for (const width of [320, 390, 1440]) for (const dark of [false, true]) for (const lang of ['it', 'en']) {
  test(`surfaces ${width}px ${dark ? 'dark' : 'light'} ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupSurfaces(page, { dark, lang })
    for (const [index, path] of surfacePaths.entries()) {
      await page.goto(path)
      await ready(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if (capture) {
        const dir = resolve(mediaDir, capture)
        mkdirSync(dir, { recursive: true })
        await page.screenshot({ path: `${dir}/${views[index]}-${width}-${dark ? 'dark' : 'light'}-${lang}.png`, fullPage: true })
      }
      if (capture !== 'before') {
        await expect(page.locator('.surface-primary').first()).toBeVisible()
        const metadata = page.locator('.surface-primary .content-metadata').first()
        await expect(metadata).toBeVisible()
        expect(await metadata.evaluate(el => getComputedStyle(el).color)).not.toBe(await metadata.evaluate(el => getComputedStyle(el.closest('.surface-primary')!).color))
        if (index < 2) {
          await expect(page.locator('.day-notes')).toContainText('quaderno')
          await expect(page.locator('.lab-notes')).toContainText('repository')
        }
      }
    }
  })
}

test.describe('accessibility and preserved controls', () => {
  test.skip(capture === 'before', 'The baseline capture records the unchanged application.')

  for (const width of [320, 390, 1440]) for (const dark of [false, true]) for (const lang of ['it', 'en']) {
    test(`long text at 200% ${width}px ${dark ? 'dark' : 'light'} ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await setupSurfaces(page, { dark, lang, long: true })
      for (const [index, path] of surfacePaths.entries()) {
        await page.goto(path)
        await ready(page)
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        // Inspect actual glyphs, including authored unbroken words and author names.
        const clipped = await page.locator('main .surface-primary, main .surface-support, main .notice-info, main .notice-warning').evaluateAll(surfaces => {
          const failures: string[] = []
          for (const surface of surfaces) {
            const bounds = surface.getBoundingClientRect()
            if (bounds.right > innerWidth + 1 || bounds.left < -1) failures.push(`surface: ${surface.className}`)
            const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              const node = walker.currentNode
              if (!node.textContent?.trim() || !(node.parentElement as HTMLElement).checkVisibility()) continue
              const range = document.createRange()
              range.selectNodeContents(node)
              for (const rect of range.getClientRects()) {
                if (rect.width && (rect.right > bounds.right + 1 || rect.left < bounds.left - 1)) failures.push(node.textContent.trim().slice(0, 80))
              }
            }
          }
          return failures
        })
        expect(clipped).toEqual([])
        if (capture === 'after' && ((width === 320 && dark && lang === 'en') || (width === 390 && !dark && lang === 'it'))) {
          await page.screenshot({ path: resolve(mediaDir, `after/long-200-${views[index]}-${width}-${dark ? 'dark' : 'light'}-${lang}.png`), fullPage: true })
        }
        if (path === surfacePaths[2]) {
          const done = page.getByRole('button', { name: lang === 'it' ? 'Segna come fatto' : 'Mark as done' }).first()
          await done.focus()
          await expect(done).toBeFocused()
          await page.keyboard.press('Space')
          await expect(done).toHaveAttribute('aria-pressed', 'true')
        }
      }
    })
  }

  for (const dark of [false, true]) {
    test(`loading errors retain a keyboard retry (${dark ? 'dark' : 'light'})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 960 })
      await setupSurfaces(page, { dark })
      let fail = true
      await page.route('**/api/classes/TEST/today', async route => {
        if (!fail) return route.fallback()
        fail = false
        await route.fulfill({ status: 403, json: { detail: 'Impossibile caricare la giornata di prova' } })
      })
      await page.goto('/c/TEST')
      const error = page.getByRole('alert')
      await expect(error).toContainText('Impossibile caricare')
      if (capture === 'after') await page.screenshot({ path: resolve(mediaDir, `after/error-390-${dark ? 'dark' : 'light'}-it.png`), fullPage: true })
      await page.getByRole('button', { name: 'Riprova', exact: true }).focus()
      await page.keyboard.press('Enter')
      await ready(page)
      await expect(error).toHaveCount(0)
    })

    test(`ordinary, action and warning states remain distinct (${dark ? 'dark' : 'light'})`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 960 })
      for (const status of ['published', 'draft', 'no_school', 'future', 'open'] as const) {
        await page.unroute('**/api/**')
        await setupSurfaces(page, { dark, status, important: false })
        await page.goto('/c/TEST')
        const banner = page.locator('section[aria-live="polite"]')
        await expect(banner).toBeVisible()
        await expect(banner).toHaveClass(new RegExp(status === 'open' ? 'notice-warning' : ['published', 'no_school'].includes(status) ? 'notice-info' : 'surface-support'))
        if (status === 'open') {
          const takeOver = banner.getByRole('button', { name: 'Prendi tu il turno' })
          await takeOver.focus()
          await expect(takeOver).toBeFocused()
          expect(await takeOver.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
        }
      }
      await page.unroute('**/api/**')
      await setupSurfaces(page, { dark, status: 'draft', important: false, mine: true })
      await page.goto('/c/TEST')
      const action = page.locator('section[aria-live="polite"]')
      await expect(action).toHaveClass(/notice-action/)
      await expect(action.locator('[data-tour="write"]')).toBeVisible()
      if (capture === 'after') await page.screenshot({ path: resolve(mediaDir, `after/action-320-${dark ? 'dark' : 'light'}-it.png`), fullPage: true })
    })
  }

  test('metadata actions, filters and published content work from the keyboard', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const { items } = await setupSurfaces(page)
    await page.goto('/c/TEST/in-arrivo')
    await ready(page)
    const calendar = page.getByRole('button', { name: /Aggiungi al calendario/ }).first()
    // Traverse the actual Tab order: metadata actions must remain keyboard reachable.
    for (let index = 0; index < 60 && !(await calendar.evaluate(el => el === document.activeElement)); index++) await page.keyboard.press('Tab')
    await expect(calendar).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(calendar).toBeFocused()
    const thanks = page.getByRole('button', { name: /Grazie/ }).first()
    await thanks.focus()
    await page.keyboard.press('Enter')
    await expect(thanks).toHaveAttribute('aria-pressed', 'true')
    const report = page.getByRole('button', { name: 'Segnala un errore' }).first()
    await report.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(report).toBeFocused()
    const tests = page.getByRole('button', { name: 'Verifiche', exact: true })
    await tests.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: items[1].title, exact: true })).toBeVisible()
    // Our fixture returns every type; changing the subject is filtered client-side.
    await page.getByRole('button', { name: 'Materia', exact: true }).click()
    await page.getByRole('option', { name: 'Matematica', exact: true }).click()
    await expect(page.getByRole('button', { name: items[0].title, exact: true })).toHaveCount(0)
    await page.goto(surfacePaths[1])
    await ready(page)
    await expect(page.getByRole('button', { name: 'Ascolta', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Condividi', exact: true })).toBeVisible()
    await expect(page.locator('.day-sheet a[href="https://example.org/progetto"]')).toBeVisible()
    expect(await page.locator('.day-sheet').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  })
})
