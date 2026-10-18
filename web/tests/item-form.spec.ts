import { expect, test, type Page } from '@playwright/test'
import { card, cardPage, info } from './lesson-fixture'
import type { Card, Item, ItemType } from '../src/types'

const types: ItemType[] = ['compito', 'verifica', 'evento', 'lab']
const labels = {
  it: { add: 'Aggiungi', close: 'Chiudi', title: 'Cosa', date: 'Scegli data', source: 'Fonte', subject: 'Materia', link: 'Link (opzionale)', types: ['Compito', 'Verifica', 'Evento', 'Lab'] },
  en: { add: 'Add', close: 'Close', title: 'What', date: 'Pick a date', source: 'Source', subject: 'Subject', link: 'Link (optional)', types: ['Homework', 'Test', 'Event', 'Lab'] },
}

async function setup(page: Page, { width = 390, lang = 'it' as 'it' | 'en', dark = false, editor = false } = {}) {
  await page.setViewportSize({ width, height: 844 })
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-02T18:30')
  }, { lang, dark })
  let saved: Card = { ...structuredClone(card), attachments: [], entries: card.entries.map(entry => ({ ...entry, attachment_ids: [] })) }
  const items: Item[] = Array.from({ length: 20 }, (_, id) => ({
    id, type: 'compito', subject_code: 'INI', title: `Esercizi ${id + 1}`, due_date: '2026-10-03', due_time: null,
    source: 'detto in classe', link: '', author: info.viewer.member, status: 'published', card_day: null, can_edit: true,
  }))
  const submissions: unknown[] = []
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api', '')
    if (path.endsWith('/upcoming') && request.method() === 'POST') {
      const body = request.postDataJSON()
      submissions.push(body)
      items.push({ ...items[0], ...body, id: items.length })
      await route.fulfill({ json: items.at(-1) })
      return
    }
    if (path.endsWith(`/cards/${card.day}`) && request.method() === 'PUT') {
      const body = request.postDataJSON()
      saved = { ...saved, ...body, revision: saved.revision + 1 }
      await route.fulfill({ json: saved })
      return
    }
    const pageData = cardPage(saved)
    const routes: Record<string, unknown> = {
      '/classes/TEST': info,
      '/me': { kind: 'member', member: info.viewer.member, classroom: info },
      '/classes/TEST/today': { ...pageData.state, now: '2026-10-02T18:30:00+02:00', card: null, lessons: [], next_lessons: { INI: '2026-10-05' }, next_school_day: null, upcoming_soon: [], open_corrections: 0 },
      '/classes/TEST/upcoming': items,
      [`/classes/TEST/cards/${card.day}`]: pageData,
      '/healthz': { ok: true, version: 'dev' },
    }
    await route.fulfill({ json: routes[path] ?? {} })
  })
  await page.goto(`/c/TEST/${editor ? `scrivi/${card.day}` : 'in-arrivo'}`)
  const text = labels[lang]
  const trigger = editor
    ? page.getByRole('button', { name: text.types[0], exact: true }).first()
    : page.getByRole('button', { name: text.add, exact: true }).last()
  await expect(trigger).toBeVisible()
  return { text, trigger, submissions, saved: () => saved }
}

test('closing the sheet restores its opener and the original page scroll', async ({ page }) => {
  const { text, trigger } = await setup(page)
  await page.evaluate(() => scrollTo(0, 400))
  await trigger.focus()
  const scroll = await page.evaluate(() => scrollY)
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(text.title, { exact: true }).fill('Esercizi di prova')
  await dialog.getByRole('button', { name: text.close, exact: true }).click()
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => scrollY)).toBe(scroll)
})

for (const width of [320, 390]) for (const lang of ['it', 'en'] as const) for (const dark of [false, true]) for (const editor of [false, true]) {
  test(`${width}px ${lang} ${dark ? 'dark' : 'light'} ${editor ? 'editor' : 'upcoming'}: focus, keyboard viewport, all item types and save`, async ({ page }) => {
    const { text, trigger, submissions, saved } = await setup(page, { width, lang, dark, editor })
    for (const [index, type] of types.entries()) {
      if (editor) await trigger.scrollIntoViewIfNeeded()
      else await page.evaluate(() => scrollTo(0, 400))
      await trigger.focus()
      const before = await page.evaluate(() => ({ scroll: scrollY, style: document.body.style.cssText, main: document.querySelector('main')!.getBoundingClientRect().top }))
      await trigger.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('button', { name: text.close, exact: true })).toBeFocused()
      expect(await page.evaluate(() => document.body.style.position)).toBe('fixed')
      expect(await page.evaluate(() => parseFloat(document.body.style.top))).toBeCloseTo(-before.scroll, 0)
      expect(await page.locator('main').evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(before.main, 0)
      await dialog.getByRole('button', { name: text.types[index], exact: true }).click()
      await expect(dialog.getByRole('button', { name: text.types[index], exact: true })).toHaveAttribute('aria-pressed', 'true')
      await dialog.getByRole('combobox', { name: text.subject, exact: true }).selectOption('INI')
      await dialog.getByLabel(text.title, { exact: true }).fill(`Prova ${type}`)
      await dialog.getByLabel(text.date, { exact: true }).fill('2026-10-05')
      await dialog.getByRole('combobox', { name: text.source, exact: true }).selectOption('Classroom')
      await dialog.getByLabel(text.link, { exact: true }).fill('https://example.com/lezione')
      for (const control of await dialog.locator('input,select,textarea').all()) {
        await control.focus()
        expect(await control.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
        const bounds = await control.boundingBox()
        expect(bounds!.x).toBeGreaterThanOrEqual(20)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 20)
      }
      expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      // Android's resizes-content behavior: the layout viewport itself gets shorter.
      await page.setViewportSize({ width, height: 360 })
      await expect.poll(() => dialog.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(360)
      await dialog.getByLabel(text.link, { exact: true }).click()
      const button = dialog.getByRole('button', { name: text.add, exact: true })
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeInViewport()
      await expect(dialog.getByRole('button', { name: text.close, exact: true })).toBeInViewport()
      expect(await page.evaluate(() => document.body.style.top)).toBe(`${-before.scroll}px`)
      await page.setViewportSize({ width, height: 844 })
      await button.click()
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      expect(await page.evaluate(() => document.body.style.cssText)).toBe(before.style)
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(before.scroll, 0)
      if (editor) await expect.poll(() => saved().items.length).toBe(index + 1)
      else expect(submissions).toHaveLength(index + 1)
    }
    const result = (editor ? saved().items : submissions) as Item[]
    expect(result.map(item => item.type)).toEqual(types)
    expect(result.every(item => item.due_date === '2026-10-05' && item.due_time === null && item.link === 'https://example.com/lezione')).toBe(true)
  })
}

test('visual viewport offset and resize keep the sheet reachable, then detach on close', async ({ page }) => {
  const { text, trigger } = await setup(page)
  await page.evaluate(() => {
    const viewport = new EventTarget()
    Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  })
  await trigger.focus()
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await page.evaluate(() => {
    Object.assign(visualViewport!, { height: 320, offsetTop: 96 })
    visualViewport!.dispatchEvent(new Event('resize'))
    visualViewport!.dispatchEvent(new Event('scroll'))
  })
  const overlay = dialog.locator('..')
  await expect(overlay).toHaveCSS('top', '96px')
  await expect(overlay).toHaveCSS('height', '320px')
  await dialog.getByLabel(text.title, { exact: true }).fill('Tastiera aperta')
  await dialog.getByRole('button', { name: text.add, exact: true }).scrollIntoViewIfNeeded()
  const bounds = await dialog.boundingBox()
  const close = await dialog.getByRole('button', { name: text.close, exact: true }).boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(96)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(416)
  expect(close!.y).toBeGreaterThanOrEqual(bounds!.y)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => document.body.style.position)).toBe('')
  await page.evaluate(() => visualViewport!.dispatchEvent(new Event('resize')))
  await expect(dialog).toHaveCount(0)
})

test('desktop keeps 16px controls and a centered sheet; page zoom stays enabled', async ({ page, browserName }) => {
  const { text } = await setup(page, { width: 1280, editor: true })
  await page.getByRole('button', { name: 'Compito', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)))
  for (const control of await dialog.locator('input,select').all()) {
    expect(await control.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px')
  }
  expect((await dialog.boundingBox())!.width).toBe(448)
  await dialog.getByRole('button', { name: text.close, exact: true }).click()
  const viewport = await page.locator('meta[name=viewport]').getAttribute('content')
  expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*(no|0)/)
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(2)
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
    await session.detach()
  }
})

test('Tab stays in the sheet; backdrop and Escape restore the opener', async ({ page }) => {
  const { trigger } = await setup(page)
  for (const dismiss of ['backdrop', 'escape']) {
    await trigger.focus()
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Cosa', { exact: true }).fill('Prova tastiera')
    const close = dialog.getByRole('button').first()
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Aggiungi', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    if (dismiss === 'escape') await page.keyboard.press('Escape')
    else await dialog.locator('..').click({ position: { x: 5, y: 5 } })
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
})
