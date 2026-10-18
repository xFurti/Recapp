import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const mediaRoot = fileURLToPath(new URL('../../docs/screenshots/issue-129/', import.meta.url))
import { card as fixture, info, cardPage } from './lesson-fixture'
import type { Card, Item } from '../src/types'

const nick = 'AlessandraConUnNicknameMoltoLungoSenzaSpazi'
const title = 'Preparare una relazione dettagliata sui sistemi informatici / Prepare a detailed report on information systems'
const prose = 'Confrontare i risultati e descrivere ogni passaggio, motivando le scelte e indicando gli esempi discussi durante la lezione. Compare the results and explain each step, including the examples discussed in class.'
const author = { ...info.viewer.member!, nick }
const item: Item = { id: 1, type: 'compito', subject_code: 'INI', title, due_date: '2026-10-03', due_time: null, source: 'detto in classe', link: 'https://example.com', author, status: 'published', card_day: null, can_edit: true }
const published: Card = {
  ...fixture, status: 'published', author, published_at: '2026-10-02T12:10:00Z', attachments: [],
  notes: prose, items: [item],
  entries: fixture.entries.map(entry => ({ ...entry, bullets: [prose, 'DocumentazioneSenzaSpazi'.repeat(8)], attachment_ids: [], lab: entry.lab ? { ...entry.lab, notes: prose } : null })),
}
const routes = [
  { name: 'oggi', path: '/c/TEST' },
  { name: 'materia', path: '/c/TEST/materia/INI' },
  { name: 'elenco', path: '/c/TEST/in-arrivo' },
  { name: 'editor', path: '/c/TEST/scrivi/2026-10-02' },
]

async function setup(page: Page, lang: string, dark: boolean) {
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-02T18:30')
  }, { lang, dark })
  let saved = structuredClone(published)
  const classroom = { ...info, viewer: { ...info.viewer, member: { ...author, role: 'admin' } } }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    if (route.request().method() === 'PUT' && path.endsWith('/cards/2026-10-02')) {
      saved = { ...saved, ...route.request().postDataJSON(), revision: saved.revision + 1 }
      await route.fulfill({ json: saved })
      return
    }
    const data = cardPage(saved)
    const response: Record<string, unknown> = {
      '/classes/TEST': classroom,
      '/me': { kind: 'member', member: classroom.viewer.member, classroom },
      '/classes/TEST/today': { ...data.state, status: 'published', now: '2026-10-02T18:30:00+02:00', card: published, lessons: [], next_lessons: {}, next_school_day: null, upcoming_soon: [item], open_corrections: 0 },
      '/classes/TEST/cards/2026-10-02': data,
      '/classes/TEST/cards/2026-10-02/feedback': { thanks: 0, thanked: false, open_corrections: 0, comments: [] },
      '/classes/TEST/subjects/INI/entries': [{ ...published.entries[0], day: published.day, author, updated_by: null, items: [item] }],
      '/classes/TEST/upcoming': [item],
      '/classes/TEST/item-thanks': { items: [] },
      '/healthz': { ok: true, version: 'dev' },
    }
    await route.fulfill({ json: response[path] ?? {} })
  })
}

async function noOverflow(page: Page) {
  const overflow = await page.locator('body *').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' }).map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent?.slice(0, 45) })))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow.slice(-15))).toBe(true)
  const clipped = await page.locator('main h1, main h2, main h3, main .type-meta, main .type-prose, main .type-item-title').evaluateAll(elements => elements.filter(el => {
    const style = getComputedStyle(el)
    return style.display !== 'inline' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2
  }).map(el => ({ text: el.textContent?.slice(0, 90), width: el.clientWidth, scroll: el.scrollWidth })))
  expect(clipped, 'headings, notes and metadata do not clip').toEqual([])
}

for (const width of [320, 390, 1440]) for (const lang of ['it', 'en']) for (const dark of [false, true]) {
  test(`${width} ${lang} ${dark ? 'dark' : 'light'}: reading, lists and editor`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setup(page, lang, dark)
    for (const view of routes) {
      await page.goto(view.path)
      await expect(page.locator('main h1')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      if (view.name === 'elenco') await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
      else if (view.name === 'editor') await expect(page.locator('main textarea').first()).toBeVisible()
      else await expect(page.locator('main').getByText(prose, { exact: true }).first()).toBeVisible()
      if (process.env.TYPOGRAPHY_CAPTURE) {
        const folder = resolve(mediaRoot, process.env.TYPOGRAPHY_CAPTURE)
        await mkdir(folder, { recursive: true })
        await page.screenshot({ path: resolve(folder, `${view.name}-${width}-${lang}-${dark ? 'dark' : 'light'}.jpg`), fullPage: true, type: 'jpeg', quality: 75, animations: 'disabled' })
      }
      if (process.env.TYPOGRAPHY_CAPTURE === 'before') continue
      await noOverflow(page)
      await expect(page.locator('main h1')).toHaveCSS('font-weight', '700')
      for (const prose of await page.locator('main .type-prose').all()) {
        const metrics = await prose.evaluate(el => { const s = getComputedStyle(el); return { size: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) } })
        expect(metrics.size).toBe(16)
        expect(metrics.line / metrics.size).toBeCloseTo(1.6)
      }
      // Text-only enlargement: rem typography and controls must reflow at the original viewport width.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      await noOverflow(page)
      if (view.name === 'editor') {
        if (width <= 390) await expect(page.locator('.editor-actions')).toHaveCSS('position', 'static')
        for (const label of await page.locator('.lesson-status-option > span:first-of-type').all()) {
          expect((await label.boundingBox())!.width, 'lesson status keeps readable words at 200%').toBeGreaterThanOrEqual(100)
        }
      }
      if (view.name === 'elenco') for (const title of await page.locator('main button.type-item-title:visible').all()) {
        expect((await title.boundingBox())!.width, 'list title retains room for words at 200%').toBeGreaterThanOrEqual(140)
      }
      if (process.env.TYPOGRAPHY_CAPTURE && width === 320 && lang === 'en' && dark) {
        await page.screenshot({ path: resolve(mediaRoot, `after/${view.name}-320-en-dark-200.jpg`), fullPage: true, type: 'jpeg', quality: 75, animations: 'disabled' })
      }
      const actionable = page.locator('main button:not(:disabled):visible, main a[href]:visible').first()
      await actionable.focus()
      await expect(actionable).toBeFocused()
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.matches('button, a, input, textarea, select'))).toBe(true)
      expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none')
    }
  })
}

for (const lang of ['it', 'en']) test(`wrapping editor bullets preserve keyboard editing and autosave (${lang})`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setup(page, lang, true)
  await page.goto('/c/TEST/scrivi/2026-10-02')
  await expect(page.locator('main h1')).toBeVisible()
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  const bullet = page.getByRole('textbox', { name: /(?:Informatica|Computer science).* · 1/ })
  await bullet.fill(prose)
  await bullet.focus()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  const second = page.getByRole('textbox', { name: /(?:Informatica|Computer science).* · 2/ })
  await expect(second).toBeFocused()
  await page.keyboard.press('Backspace')
  await expect(bullet).toBeFocused()
  await bullet.fill(prose + ' Revisione finale.')
  const request = await page.waitForRequest(request => request.method() === 'PUT' && request.url().includes('/cards/2026-10-02'))
  expect(request.postDataJSON().entries[0].bullets[0]).toBe(prose + ' Revisione finale.')
  expect(await bullet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await bullet.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true)
  await page.getByRole('button', { name: lang === 'it' ? 'Anteprima' : 'Preview', exact: true }).click()
  await expect(page.getByText(prose + ' Revisione finale.', { exact: true })).toBeVisible()
  await noOverflow(page)
})
