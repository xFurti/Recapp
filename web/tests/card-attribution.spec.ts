import { expect, test, type Page } from '@playwright/test'
import type { Card, CardSummary, ClassInfo, SubjectEntryRow, TodayInfo } from '../src/types'
import { card as draftFixture, info as infoFixture, cardPage } from './lesson-fixture'

const ada = { id: 2, nick: 'Ada', color: '#A02848' }
const leo = { id: 1, nick: 'Leo', color: '#1898C8' }
const published: Card = {
  ...draftFixture, status: 'published', author: ada, updated_by: leo,
  published_at: '2026-10-02T12:10:00Z', updated_at: '2026-10-02T16:30:00Z', attachments: [],
  entries: [{ ...draftFixture.entries[0], attachment_ids: [] }],
  items: [ada, leo].map((author, index) => ({
    id: index + 1, type: 'compito', subject_code: 'INI', title: index ? 'Nuovo compito' : 'Primo compito',
    due_date: '2026-10-03', due_time: null, source: 'detto in classe', link: '', attachment_id: null,
    author, status: 'published', card_day: '2026-10-02',
  })),
}

async function setup(page: Page, { lang = 'it', demo = false, card = published, viewer = ada, admin = false } = {}) {
  await page.addInitScript(({ lang }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.simulatedNow', '2026-10-02T18:30')
  }, { lang })
  const info: ClassInfo = {
    ...infoFixture, is_demo: demo,
    viewer: { kind: 'member', member: { ...viewer, role: admin ? 'admin' : 'member' }, can_manage: admin, read_only: false, tour_seen: true },
  }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const pageData = cardPage(card)
    pageData.state = { ...pageData.state, status: card.status, is_me_scribe: false, can_write: true }
    const summary: CardSummary = { day: card.day, author: card.author, updated_by: card.updated_by, published_at: card.published_at, subjects: ['INI'], has_lab: true, items: 2 }
    const subject: SubjectEntryRow = { ...card.entries[0], day: card.day, author: card.author, updated_by: card.updated_by, items: card.items }
    const today: TodayInfo = {
      ...pageData.state, now: '2026-10-02T18:30:00+02:00', card, lessons: [], next_lessons: {},
      next_school_day: null, upcoming_soon: [], open_corrections: 0,
    }
    const routes: Record<string, unknown> = {
      '/classes/TEST': info,
      '/me': { kind: 'member', member: info.viewer.member, classroom: info },
      '/classes/TEST/today': today,
      '/classes/TEST/cards': [summary],
      '/classes/TEST/cards/2026-10-02': pageData,
      '/classes/TEST/cards/2026-10-02/feedback': { thanks: 0, thanked: false, open_corrections: 0, comments: [] },
      '/classes/TEST/subjects/INI/entries': [subject],
      '/healthz': { ok: true, version: 'dev' },
    }
    await route.fulfill({ json: routes[path] ?? {} })
  })
}

for (const demo of [false, true]) {
  for (const mobile of [false, true]) {
    for (const lang of ['it', 'en']) {
      test(`publisher and updater stay distinct in all views (${demo ? 'demo' : 'official'}, ${mobile ? 'phone' : 'desktop'}, ${lang})`, async ({ page }) => {
        await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
        await setup(page, { demo, lang })
        const updated = lang === 'it' ? 'Aggiornata da Leo' : 'Updated by Leo'
        await page.goto('/c/TEST')
        const banner = page.locator('section[aria-live="polite"]')
        await expect(banner).toContainText(lang === 'it' ? 'Pubblicata da Ada alle 14:10' : 'Published by Ada at 14:10')
        await expect(banner).toContainText(updated)
        // Today names publisher and updater once, in its header: no second card heading repeats them.
        await expect(page.getByText(updated, { exact: true })).toHaveCount(1)
        await expect(page.locator('main').getByText(/Ada/)).toHaveCount(1)
        // The original author still sees Share even without admin or current-scribe rights.
        await expect(page.getByRole('button', { name: lang === 'it' ? 'Condividi' : 'Share', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: lang === 'it' ? 'Modifica' : 'Edit', exact: true })).toBeVisible()
        for (const path of ['/c/TEST/giorno/2026-10-02', '/c/TEST/giorni', '/c/TEST/materia/INI']) {
          await page.goto(path)
          await expect(page.getByText(updated, { exact: true })).toBeVisible()
          await expect(page.getByText(lang === 'it' ? /di Ada/ : /by Ada/).first()).toBeVisible()
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        }
      })
    }
  }
}

for (const lang of ['it', 'en']) {
  test(`listen and shared image credit the publisher and latest editor (${lang})`, async ({ page }) => {
    await setup(page, { lang })
    await page.addInitScript(() => {
      const capture = { speech: [] as string[], canvas: [] as string[], layout: [] as { text: string; top: number; bottom: number }[], shared: false }
      Object.assign(window, { attributionCapture: capture })
      const engine = new EventTarget()
      Object.assign(engine, {
        getVoices: () => [{ lang: 'it-IT' }, { lang: 'en-GB' }],
        cancel: () => {},
        resume: () => {},
        speak: (utterance: SpeechSynthesisUtterance) => {
          capture.speech.push(utterance.text)
          queueMicrotask(() => { utterance.onstart?.({} as SpeechSynthesisEvent); utterance.onend?.({} as SpeechSynthesisEvent) })
        },
      })
      Object.defineProperty(window, 'speechSynthesis', { value: engine })
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class {
        text: string
        constructor(text: string) { this.text = text }
      } })
      const fillText = CanvasRenderingContext2D.prototype.fillText
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        capture.canvas.push(text)
        const metrics = this.measureText(text)
        capture.layout.push({ text, top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent })
        fillText.call(this, text, x, y, maxWidth)
      }
      Object.defineProperty(navigator, 'canShare', { value: () => true })
      Object.defineProperty(navigator, 'share', { value: async () => { capture.shared = true } })
    })
    await page.goto('/c/TEST')
    await page.getByRole('button', { name: lang === 'it' ? 'Ascolta' : 'Listen', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).attributionCapture.speech.join(' '))).toContain(lang === 'it' ? 'pubblicata da Ada alle 14:10' : 'published by Ada at 14:10')
    await expect.poll(() => page.evaluate(() => (window as any).attributionCapture.speech.join(' '))).toContain(lang === 'it' ? 'Aggiornata da Leo' : 'Updated by Leo')
    await page.getByRole('button', { name: lang === 'it' ? 'Condividi' : 'Share', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).attributionCapture.shared)).toBe(true)
    const canvas = await page.evaluate(() => (window as any).attributionCapture.canvas as string[])
    expect(canvas).toContain(lang === 'it' ? 'Pubblicata da Ada' : 'Published by Ada')
    expect(canvas).toContain(lang === 'it' ? 'Aggiornata da Leo' : 'Updated by Leo')
    expect(canvas).not.toContain(lang === 'it' ? 'Pubblicata da Leo' : 'Published by Leo')
    const layout = await page.evaluate(() => (window as any).attributionCapture.layout as { text: string; top: number; bottom: number }[])
    const publisher = layout.find(row => row.text === (lang === 'it' ? 'Pubblicata da Ada' : 'Published by Ada'))!
    const updater = layout.find(row => row.text === (lang === 'it' ? 'Aggiornata da Leo' : 'Updated by Leo'))!
    const heading = layout.find(row => row.text === (lang === 'it' ? 'Abbiamo fatto' : 'We covered'))!
    expect(publisher.bottom).toBeLessThan(updater.top)
    expect(updater.bottom).toBeLessThan(heading.top)
  })

  test(`author's own edit has one attribution and draft credits current writer (${lang})`, async ({ page }) => {
    await setup(page, { lang, card: { ...published, updated_by: null } })
    await page.goto('/c/TEST')
    await expect(page.locator('section[aria-live="polite"]')).toContainText(lang === 'it' ? 'Pubblicata da Ada' : 'Published by Ada')
    await expect(page.getByText(lang === 'it' ? /Aggiornata da/ : /Updated by/)).toHaveCount(0)
    await page.unroute('**/api/**')
    await setup(page, { lang, card: { ...published, status: 'draft', author: leo, updated_by: null, published_at: null }, viewer: leo, admin: true })
    await page.goto('/c/TEST/scrivi/2026-10-02')
    await page.getByRole('button', { name: lang === 'it' ? 'Anteprima' : 'Preview', exact: true }).click()
    await expect(page.locator('article header')).toContainText(lang === 'it' ? 'di Leo' : 'by Leo')
    await expect(page.getByText(lang === 'it' ? /Aggiornata da/ : /Updated by/)).toHaveCount(0)
  })
}

test('admin preview retains publisher and updater', async ({ page }) => {
  await setup(page, { viewer: leo, admin: true })
  await page.goto('/c/TEST/scrivi/2026-10-02')
  await page.getByRole('button', { name: 'Anteprima', exact: true }).click()
  await expect(page.locator('article header')).toContainText('di Ada')
  await expect(page.locator('article header')).toContainText('Aggiornata da Leo')
})
