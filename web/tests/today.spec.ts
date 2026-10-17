import { expect, test, type Page } from '@playwright/test'
import { longNick, todayInfo, type Scenario } from './today-fixture'
import type { TodayInfo } from '../src/types'

type Options = { patch?: Partial<TodayInfo>; width?: number; height?: number; lang?: 'it' | 'en'; dark?: boolean; reduced?: boolean; empty?: boolean; nick?: string; who?: string; zoom?: number }

async function setup(page: Page, scenario: Scenario, { width = 1280, height = 900, lang = 'it', dark = false, reduced = false, empty = false, nick, who = 'member', zoom, patch }: Options = {}) {
  const state = { today: { ...todayInfo(scenario, { empty, nick }), ...patch }, reads: 0, passes: 0, takeovers: 0 }
  await page.setViewportSize({ width, height })
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.simulatedNow', '2026-10-14T16:00')
  }, { lang, dark })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    if (path === '/classes/TEST/today') {
      state.reads++
      return route.fulfill({ json: state.today })
    }
    if (path === '/classes/TEST/today/pass') {
      state.passes++
      state.today = { ...state.today, status: 'open', scribe: null, override_reason: 'pass', is_me_scribe: false, can_pass: false, can_takeover: true }
      return route.fulfill({ json: { ok: true } })
    }
    if (path === '/classes/TEST/today/takeover') {
      state.takeovers++
      return route.fulfill({ json: { ok: true } })
    }
    if (path.endsWith('/feedback')) return route.fulfill({ json: { thanks: 3, thanked: false, can_thank: true, open_corrections: 0, comments: [] } })
    if (path === '/classes/TEST/upcoming/corrections') return route.fulfill({ json: { pending_count: 0, items: [] } })
    return route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto(`/tests/today.html?who=${who}`)
  if (zoom) await page.addStyleTag({ content: `html { font-size: ${zoom}% !important; }` })
  const sheet = page.locator('article.today-sheet')
  await expect(sheet).toBeVisible()
  return { sheet, state, set: (next: TodayInfo) => { state.today = next } }
}

const noOverflow = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

/** The part of the viewport not covered by the sticky header or the phone tab bar. */
async function visibleBand(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header.sticky')!.getBoundingClientRect()
    const bar = document.querySelector('.tab-bar')!.getBoundingClientRect()
    const barTop = getComputedStyle(document.querySelector('.tab-bar')!).display === 'none' ? innerHeight : bar.top
    return { top: header.bottom, bottom: Math.min(innerHeight, barTop) }
  })
}

for (const lang of ['it', 'en'] as const) {
  const T = lang === 'it'
    ? { date: 'Mercoledì 14 ottobre', write: 'Scrivi la giornata', soon: 'Nei prossimi 3 giorni', all: 'Tutto In arrivo', stamp: 'Tocca a te' }
    : { date: 'Wednesday 14 October', write: 'Write the day', soon: 'Next 3 days', all: 'All upcoming', stamp: 'Your turn' }

  test(`320px phone: date, action and first ticket fit above the tab bar (${lang})`, async ({ page }) => {
    const { sheet } = await setup(page, 'mine', { width: 320, height: 568, lang, reduced: true })
    await expect(sheet.getByRole('heading', { level: 1 })).toHaveText(T.date)
    await expect(sheet.locator('.today-stamp')).toContainText(T.stamp)
    const band = await visibleBand(page)
    const action = await sheet.getByRole('button', { name: T.write }).boundingBox()
    const ticket = await sheet.locator('[data-ticket]').first().boundingBox()
    const date = await sheet.getByRole('heading', { level: 1 }).boundingBox()
    for (const box of [date!, action!, ticket!]) {
      expect(box.y).toBeGreaterThanOrEqual(band.top - 1)
      expect(box.y + box.height).toBeLessThanOrEqual(band.bottom + 1)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(320 + 1)
    }
    // The primary action spans the header; the next ticket peeks in from the side.
    expect(action!.width).toBeGreaterThan(220)
    const second = await sheet.locator('[data-ticket]').nth(1).boundingBox()
    expect(second!.x).toBeLessThan(320)
    await noOverflow(page)
  })

  test(`desktop: same blocks in the same order, wide sheet, four tickets in a row, readable notes (${lang})`, async ({ page }) => {
    const { sheet } = await setup(page, 'published', { lang, reduced: true })
    const width = (await sheet.boundingBox())!.width
    expect(width).toBeGreaterThan(900)
    const tops = await sheet.locator('[data-ticket]').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)))
    expect(new Set(tops.slice(0, 4)).size).toBe(1)
    const order = await page.evaluate(() => ['.today-tabs', '.today-head', '.today-soon', '.today-notes'].map(s => document.querySelector(s)!.getBoundingClientRect().top))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const entry = await sheet.locator('.today-entry').first().boundingBox()
    expect(entry!.width).toBeLessThanOrEqual(44 * 16 + 1)
    await expect(sheet.getByRole('link', { name: T.all })).toHaveAttribute('href', '/c/TEST/in-arrivo')
    // The date is written once and the author appears once, in the stamp.
    await expect(sheet.getByText(T.date)).toHaveCount(1)
    expect((await sheet.innerText()).match(/Giulia/g)?.length).toBe(1)
    await expect(sheet.locator('.today-stamp')).toContainText(lang === 'it' ? 'Pubblicata' : 'Published')
    await noOverflow(page)
  })
}

test('the same blocks keep their order on the phone', async ({ page }) => {
  await setup(page, 'published', { width: 390, height: 844, reduced: true })
  const order = await page.evaluate(() => ['.today-tabs', '.today-head', '.today-soon', '.today-notes'].map(s => document.querySelector(s)!.getBoundingClientRect().top))
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  // Lesson tabs scroll sideways and the first one stays whole.
  const first = await page.locator('.today-tab').first().boundingBox()
  expect(first!.x).toBeGreaterThanOrEqual(0)
  expect(first!.x + first!.width).toBeLessThanOrEqual(390)
  await noOverflow(page)
})

test('notes keep each assignment under its subject; class notes, Grazie, comments, Listen and Share stay on the sheet', async ({ page }) => {
  const { sheet } = await setup(page, 'published', { who: 'admin', reduced: true, patch: { can_write: true } })
  const math = sheet.locator('.today-entry', { hasText: 'Matematica' })
  await expect(math.getByRole('group', { name: 'Assegnato in Matematica' })).toContainText('Esercizi 1–10 pagina 112')
  await expect(sheet.locator('.today-entry', { hasText: 'Assegnato oggi' })).toContainText('Uscita didattica al museo')
  await expect(sheet).toContainText('Chi era assente recuperi')
  const notes = sheet.getByRole('region', { name: 'Appunti' })
  await expect(notes.getByRole('button', { name: /Condividi/ })).toBeVisible()
  await expect(notes.getByRole('button', { name: /Ascolta/ }).or(notes.getByText('non supportata', { exact: false }))).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Grazie/ }).last()).toBeVisible()
  await expect(sheet.getByRole('heading', { name: /Risposte|Commenti/ })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Modifica' })).toBeVisible()
})

test('zero deadlines give a single line, not an empty card', async ({ page }) => {
  const { sheet } = await setup(page, 'published', { empty: true, reduced: true })
  const soon = sheet.locator('.today-soon')
  await expect(soon).toContainText('Niente in scadenza nei prossimi 3 giorni.')
  await expect(soon.locator('[data-ticket], .today-tickets')).toHaveCount(0)
  expect((await soon.boundingBox())!.height).toBeLessThan(80)
})

const STATES: [Scenario, string, string[], string?][] = [
  ['mine', 'Tocca a te', ['Scrivi la giornata', 'Non ci sono: passo il turno'], 'Oggi tocca a te scrivere la giornata.'],
  ['my_draft', 'Tocca a te', ['Continua la bozza', 'Non ci sono: passo il turno'], 'Hai una bozza in corso.'],
  ['draft', 'Bozza', [], 'Giulia sta scrivendo la giornata…'],
  ['open', 'Turno libero', ['Prendi tu il turno'], 'Giulia non ha pubblicato la giornata.'],
  ['passed', 'Turno libero', ['Prendi tu il turno'], 'Turno aperto alla classe.'],
  ['waiting', 'Da scrivere', [], 'Giulia è il redattore di oggi.'],
  ['taken', 'Turno preso', [], 'Turno preso da Giulia.'],
  ['future', 'Non ancora', [], 'Questo giorno deve ancora arrivare.'],
  ['admin', 'Da scrivere', ['Scrivi come admin'], 'Giulia è il redattore di oggi.'],
  ['no_school', 'Niente scuola', [], 'Festa del patrono'],
]
for (const [scenario, stamp, actions, invite] of STATES) {
  test(`state ${scenario}: stamp, actions and the invitation in the body`, async ({ page }) => {
    const { sheet } = await setup(page, scenario, { who: scenario === 'admin' ? 'admin' : 'member', reduced: true })
    await expect(sheet.locator('.today-stamp')).toContainText(stamp)
    for (const name of actions) await expect(sheet.getByRole('button', { name, exact: true })).toBeVisible()
    if (!actions.length) await expect(sheet.locator('.today-actions')).toHaveCount(0)
    if (invite) await expect(sheet.locator('.today-invite')).toContainText(invite)
    await expect(sheet.locator('.today-notes')).toHaveCount(0)
  })
}

test('no school: the reason, the next school day and its note-taker; no lesson tabs', async ({ page }) => {
  const { sheet } = await setup(page, 'no_school', { reduced: true })
  await expect(sheet.locator('.today-invite')).toContainText('Prossimo giorno di scuola: gio 15 ott')
  await expect(sheet.locator('.today-invite')).toContainText('verbalista Marco')
  await expect(sheet).toHaveAttribute('data-tone', 'no_school')
  await expect(page.locator('.today-tabs')).toHaveCount(0)
})

test('open corrections stay next to the stamp', async ({ page }) => {
  const { sheet } = await setup(page, 'admin', { who: 'admin', reduced: true })
  await expect(sheet.locator('.today-status')).toContainText('2 correzioni')
})

test('passing the turn and taking it over still work', async ({ page }) => {
  const { sheet, state } = await setup(page, 'mine', { reduced: true })
  await sheet.getByRole('button', { name: 'Non ci sono: passo il turno' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Passa il turno' }).click()
  await expect(sheet.getByRole('status')).toContainText('Hai lasciato il turno di oggi.')
  await expect(sheet.locator('.today-stamp')).toContainText('Turno libero')
  expect(state.passes).toBe(1)
  await sheet.getByRole('button', { name: 'Prendi tu il turno' }).click()
  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()
  expect(state.takeovers).toBe(1)
})

test('the first-visit tour still finds the write action', async ({ page }) => {
  const { sheet } = await setup(page, 'mine', { reduced: true })
  await expect(sheet.locator('[data-tour="write"]')).toHaveText('Scrivi la giornata')
})

test('one page turn of about a second; buttons work during it and it never restarts on its own', async ({ page }) => {
  const { sheet, state } = await setup(page, 'mine')
  await expect(sheet).toHaveAttribute('data-intro', 'true')
  const duration = await page.locator('.today-leaf').evaluate(el => getComputedStyle(el).animationDuration)
  expect(parseFloat(duration)).toBeGreaterThanOrEqual(0.8)
  expect(parseFloat(duration)).toBeLessThanOrEqual(1.2)
  expect(await page.locator('.today-leaf').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')
  await expect(sheet).not.toHaveAttribute('data-intro', /.*/, { timeout: 2500 })
  // Data refreshes, language and theme changes leave the sheet still.
  const leaf = page.locator('.today-leaf')
  const still = async () => {
    await expect(sheet).not.toHaveAttribute('data-intro', /.*/)
    expect(await leaf.evaluate(el => getComputedStyle(el).display)).toBe('none')
    expect(await page.locator('.today-stamp').evaluate(el => el.getAnimations().length)).toBe(0)
  }
  const reads = state.reads
  // Passing the turn refetches the day: the stamp changes in place without landing again.
  await sheet.getByRole('button', { name: 'Non ci sono: passo il turno' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Passa il turno' }).click()
  await expect(sheet.locator('.today-stamp')).toContainText('Turno libero')
  await page.locator('.theme-toggle').click()
  await still()
  await page.locator('header button:has(.lang-swap)').click()
  await expect(sheet.getByRole('button', { name: 'Take the turn' })).toBeVisible()
  await still()
  expect(state.reads).toBeGreaterThan(reads)
})

test('the write button responds during the opening turn', async ({ page }) => {
  const { sheet } = await setup(page, 'mine')
  await expect(sheet).toHaveAttribute('data-intro', 'true')
  await sheet.getByRole('button', { name: 'Scrivi la giornata' }).click({ force: true, timeout: 500 })
  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()
})

test('reduced motion: final state at once, no decorative movement', async ({ page }) => {
  const { sheet } = await setup(page, 'published', { reduced: true })
  await expect(sheet).not.toHaveAttribute('data-intro', /.*/)
  expect(await page.locator('.today-leaf').evaluate(el => getComputedStyle(el).display)).toBe('none')
  for (const selector of ['.today-stamp', '[data-ticket]']) {
    expect(await page.locator(selector).first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  }
})

test('decorations stay silent and tickets work from the keyboard', async ({ page }) => {
  const { sheet } = await setup(page, 'published', { width: 390, height: 844, reduced: true })
  await expect(page.locator('.today-leaf')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.today-ticket-tear').first()).toHaveAttribute('aria-hidden', 'true')
  const list = sheet.locator('.today-tickets')
  await list.focus()
  await expect(list).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => list.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  const thanks = sheet.locator('[data-ticket]').first().getByRole('button', { name: /Grazie/ })
  await thanks.focus()
  await expect(thanks).toBeFocused()
})

for (const [name, options] of [
  ['dark English 320px', { width: 320, height: 568, lang: 'en', dark: true }],
  ['long names, 200% text, 320px', { width: 320, height: 568, nick: longNick, zoom: 200 }],
  ['long names, 200% text, desktop', { nick: longNick, zoom: 200 }],
] as const) {
  for (const scenario of ['published', 'mine', 'no_school'] as const) {
    test(`no overflow: ${scenario}, ${name}`, async ({ page }) => {
      const { sheet } = await setup(page, scenario, { ...options, reduced: true })
      await noOverflow(page)
      const clipped = await sheet.evaluate(root => [...root.querySelectorAll<HTMLElement>('h1, button, .today-stamp, .today-invite p')]
        .filter(el => !el.querySelector('.sr-only') && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible').map(el => el.textContent))
      expect(clipped).toEqual([])
    })
  }
}
