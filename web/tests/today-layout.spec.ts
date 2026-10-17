import { expect, test, type Page } from '@playwright/test'
import type { Card, ClassInfo, Item, Lesson, TodayInfo } from '../src/types'
import { info as infoFixture } from './lesson-fixture'

const ada = { id: 2, nick: 'Ada', color: '#A02848' }
const leo = { id: 1, nick: 'Leo', color: '#1898C8' }
const info: ClassInfo = {
  ...infoFixture,
  subjects: [...infoFixture.subjects, { code: 'ITA', name_it: 'Italiano', name_en: 'Italian', color: '#a02848' }],
  viewer: { kind: 'member', member: { ...leo, role: 'member' }, can_manage: false, read_only: false, tour_seen: true },
}
const lessons: Lesson[] = [
  { subject_code: 'ITA', hours: [1], hours_label: '1', start: '08:00', end: '08:50', room: 'A12', is_lab: false },
  { subject_code: 'INI', hours: [2, 3], hours_label: '2-3', start: '08:50', end: '10:40', room: 'L143', is_lab: true },
  { subject_code: 'MAT', hours: [4], hours_label: '4', start: '10:50', end: '11:40', room: 'A102', is_lab: false },
]
const item = (id: number, over: Partial<Item>): Item => ({
  id, type: 'compito', subject_code: 'MAT', title: `Compito ${id}`, due_date: '2026-10-03', due_time: null, source: 'detto in classe',
  link: '', attachment_id: null, author: { id: 3, nick: 'Bea', color: '#80B830' }, status: 'published', card_day: null, can_thank: true, thanks: 0, thanked: false,
  can_request_correction: true, ...over,
})
// Assigned today: one due tomorrow (also among the deadlines), one due next week (only under its subject).
const tomorrow = item(1, { title: 'Esercizi 12-15 pagina 112', card_day: '2026-10-02' })
const later = item(2, { type: 'verifica', subject_code: 'INI', title: 'Verifica sulle API REST', due_date: '2026-10-12', card_day: '2026-10-02' })
const other = item(3, { type: 'verifica', subject_code: 'ITA', title: 'Verifica sul canto V con un titolo molto lungo da andare a capo', due_date: '2026-10-05' })
const card: Card = {
  id: 1, day: '2026-10-02', status: 'published', author: ada, updated_by: leo, scribe: ada, notes: 'Portare il libro', revision: 2,
  published_at: '2026-10-02T12:10:00Z', updated_at: '2026-10-02T16:30:00Z', attachments: [],
  entries: [
    { subject_code: 'ITA', hours: '1', room: 'A12', is_lab: false, lesson_status: 'svolta', bullets: ['Canto V: Paolo e Francesca'], lab: null, attachment_ids: [] },
    { subject_code: 'INI', hours: '2-3', room: 'L143', is_lab: true, lesson_status: 'svolta', bullets: ['Rotte GET e POST'], lab: null, attachment_ids: [] },
    { subject_code: 'MAT', hours: '4', room: 'A102', is_lab: false, lesson_status: 'verifica', bullets: ['Derivate composte'], lab: null, attachment_ids: [] },
  ],
  items: [tomorrow, later],
}
const base: TodayInfo = {
  day: '2026-10-02', is_school_day: true, no_school_reason: '', status: 'published', scribe: ada, override_reason: null,
  is_me_scribe: false, has_draft: false, can_write: false, can_takeover: false, can_pass: false, takeover_at: '18:00',
  now: '2026-10-02T18:30:00+02:00', lessons, card, draft_updated_at: undefined, next_school_day: { day: '2026-10-05', scribe: leo },
  upcoming_soon: [tomorrow, other], next_lessons: {}, open_corrections: 0,
}

async function setup(page: Page, today: Partial<TodayInfo> = {}, { lang = 'it', now = '2026-10-02T18:30' } = {}) {
  await page.addInitScript(({ lang, now }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.simulatedNow', now)
  }, { lang, now })
  const data = { ...base, ...today }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const routes: Record<string, unknown> = {
      '/classes/TEST': info,
      '/me': { kind: 'member', member: info.viewer.member, classroom: info },
      '/classes/TEST/today': data,
      '/classes/TEST/cards/2026-10-02/feedback': { thanks: 0, thanked: false, open_corrections: 0, comments: [] },
      '/healthz': { ok: true, version: 'dev' },
    }
    await route.fulfill({ json: routes[path] ?? {} })
  })
  await page.goto('/c/TEST')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('date, author and subjects appear once; deadlines come before the notes without duplicates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  const main = page.locator('main')
  await expect(main.getByText('Venerdì', { exact: false })).toHaveCount(1)
  await expect(main.getByText(/Ada/)).toHaveCount(1)
  await expect(main.getByText('Aggiornata da Leo', { exact: true })).toHaveCount(1)
  for (const name of ['Italiano', 'Informatica e progettazione di sistemi informatici', 'Matematica'])
    await expect(main.getByRole('heading', { name, exact: true })).toHaveCount(1)
  await expect(main.locator('.today-status')).toHaveText('Pubblicata')
  await expect(main.getByText('Verifica svolta', { exact: true })).toBeVisible()

  // The deadlines sit above the lessons; homework due soon has one full card, the later test stays under its subject.
  const deadlines = await page.locator('#today-soon').boundingBox()
  const lessonsBox = await page.locator('#today-lessons').boundingBox()
  expect(deadlines!.y).toBeLessThan(lessonsBox!.y)
  await expect(page.locator('.today-ticket')).toHaveCount(2)
  await expect(page.locator('.today-ticket').filter({ hasText: tomorrow.title })).toContainText('Nuovo oggi')
  await expect(page.getByRole('button', { name: 'Aggiungi al calendario' })).toHaveCount(3)
  await expect(page.locator('.today-stop').filter({ hasText: 'Verifica sulle API REST' })).toContainText('Informatica')
  await page.locator('.today-pointer').click()
  await expect(page.locator(`#deadline-${tomorrow.id}`)).toBeFocused()
  await expect(page.getByRole('link', { name: 'Tutto In arrivo' })).toBeVisible()
  expect(await noOverflow(page)).toBe(true)
})

test('a 320px phone shows date, state, main action and the first deadline straight away', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await setup(page, { status: 'not_started', is_me_scribe: true, can_write: true, can_pass: true, scribe: leo, card: null })
  const write = page.locator('[data-tour="write"]')
  await expect(write).toHaveCount(1)
  await expect(page.locator('.today-status')).toHaveText('Tocca a te')
  const bar = (await page.locator('.tab-bar').boundingBox())!
  for (const target of [page.getByRole('heading', { level: 1 }), page.locator('.today-status'), write, page.locator('.today-ticket').first()]) {
    const box = (await target.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + Math.min(box.height, 40)).toBeLessThanOrEqual(bar.y)
  }
  await expect(page.getByRole('button', { name: 'Non ci sono: passo il turno' })).toBeVisible()
  await expect(page.locator('.today-invite')).toContainText('Gli appunti che scrivi')
  expect(await noOverflow(page)).toBe(true)
  // The page scrolls far enough for the last content to clear the floating navigation.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const last = (await page.locator('.today-card').last().boundingBox())!
  expect(last.y + last.height).toBeLessThanOrEqual((await page.locator('.tab-bar').boundingBox())!.y)
})

test('on a computer the cards sit side by side and the notes keep a readable width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  const main = (await page.locator('.today-main').boundingBox())!
  const side = (await page.locator('.today-side').boundingBox())!
  expect(side.x).toBeGreaterThan(main.x + main.width - 1)
  expect(Math.abs(side.y - main.y)).toBeLessThan(2)
  expect(main.width + side.width).toBeGreaterThan(1000)
  const bullets = (await page.locator('.today-stop ul').first().evaluate(el => parseFloat(getComputedStyle(el).maxWidth)))
  expect(bullets).toBeLessThan(800)
})

test('the hour in progress is highlighted, earlier hours are ticked', async ({ page }) => {
  await setup(page, { status: 'not_started', card: null, now: '2026-10-02T09:30:00+02:00' }, { now: '2026-10-02T09:30' })
  await expect(page.locator('.today-stop[data-phase="past"]')).toHaveCount(1)
  await expect(page.locator('.today-stop[data-phase="now"]')).toContainText('Adesso')
  await expect(page.locator('.today-stop[data-phase="next"]')).toHaveCount(1)
})

test('zero deadlines do not leave an empty card', async ({ page }) => {
  await setup(page, { upcoming_soon: [] })
  await expect(page.locator('.today-ticket')).toHaveCount(0)
  await expect(page.locator('.today-side')).toContainText('Niente in scadenza nei prossimi 3 giorni.')
  await expect(page.locator('.today-side .today-card')).toHaveCount(0)
})

test('weekend shows why, the countdown, who writes next and the deadlines', async ({ page }) => {
  await setup(page, { day: '2026-10-03', status: 'no_school', is_school_day: false, no_school_reason: 'weekend', card: null, lessons: [], scribe: null })
  await expect(page.locator('.today-status')).toHaveText('Niente scuola')
  await expect(page.getByText('È weekend.')).toBeVisible()
  await expect(page.locator('.today-rest')).toContainText('tra 2 giorni')
  await expect(page.locator('.today-rest')).toContainText('Scrive Leo')
  await expect(page.locator('#today-lessons')).toHaveCount(0)
  await expect(page.locator('.today-ticket')).toHaveCount(2)
})

for (const [label, today, chip] of [
  ['draft', { status: 'draft', card: null, scribe: ada }, 'Bozza'],
  ['open turn', { status: 'open', card: null, can_takeover: true }, 'Turno scoperto'],
  ['turn left', { status: 'open', card: null, scribe: null, override_reason: 'pass', can_takeover: true }, 'Turno scoperto'],
  ['taken over', { status: 'not_started', card: null, override_reason: 'takeover' }, 'Turno preso'],
  ['future', { status: 'future', card: null }, 'Non ancora'],
] as const) {
  test(`state ${label} has its own label and text`, async ({ page }) => {
    await setup(page, today as Partial<TodayInfo>)
    await expect(page.locator('.today-status')).toHaveText(chip)
    await expect(page.locator('section[aria-live="polite"]')).not.toBeEmpty()
    if (label === 'turn left') await expect(page.getByText('Turno aperto alla classe.')).toBeVisible()
    if (label.includes('turn')) await expect(page.getByRole('button', { name: 'Prendi tu il turno' })).toBeVisible()
  })
}

test('the entrance plays once and does not replay on language or theme changes', async ({ page }) => {
  await setup(page)
  await expect(page.locator('.today-page[data-settled]')).toHaveCount(1, { timeout: 4000 })
  await page.locator('.lang-btn').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Friday 2 October')
  await page.evaluate(() => document.documentElement.classList.toggle('dark'))
  await page.waitForTimeout(150)
  const running = await page.evaluate(() => document.getAnimations().filter(a => {
    const el = (a.effect as KeyframeEffect | null)?.target as Element | null
    return !!el?.closest('.today-page') && (a as CSSAnimation).animationName?.startsWith('today-enter')
  }).length)
  expect(running).toBe(0)
})

test('with reduced motion the final state is there at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setup(page, { day: '2026-10-03', status: 'no_school', is_school_day: false, no_school_reason: 'weekend', card: null, lessons: [] })
  await expect(page.locator('.today-rest')).toContainText('2')
  for (const selector of ['.today-enter', '.today-date-word', '.today-status'])
    expect(await page.locator(selector).first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  expect(await page.locator('.today-card').first().evaluate(el => getComputedStyle(el, '::before').display)).toBe('none')
  expect(await page.locator('.today-rest-count [aria-hidden] .tabular-nums').textContent()).toBe('2')
})

test('decorations stay silent and every control is reachable by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await setup(page)
  for (const selector of ['.today-stop-marker', '.today-ticket-stub [aria-hidden]'])
    for (const el of await page.locator(selector).all()) expect(await el.getAttribute('aria-hidden')).not.toBeNull()
  const ticket = page.locator('.today-ticket').first()
  await expect(ticket.getByRole('button', { name: 'Segnala un errore' })).toBeVisible()
  await expect(ticket.getByRole('button', { name: 'Grazie' })).toBeVisible()
  const reached = new Set<string>()
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    reached.add(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || ''))
  }
  for (const name of ['Ascolta', 'Aggiungi al calendario', 'Segnala un errore']) expect([...reached].some(r => r.includes(name)), `${name} in ${[...reached].join(' | ')}`).toBe(true)
  // Lines of the action row never wrap.
  const rows = await page.locator('.today-ticket-actions').evaluateAll(els => els.map(el => el.getBoundingClientRect().height))
  for (const h of rows) expect(h).toBeLessThan(60)
})

for (const lang of ['it', 'en']) {
  test(`long names and enlarged text fit a 320px phone (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%' }))
    const longNick = { id: 2, nick: 'Massimiliano_Bartolomeo', color: '#A02848' }
    await setup(page, { card: { ...card, author: longNick, updated_by: { ...leo, nick: 'Ludovica_Annunziata' } } }, { lang })
    await expect(page.locator('section[aria-live="polite"]')).toContainText('Massimiliano_Bartolomeo')
    const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => `${el.tagName}.${el.className}`.slice(0, 80)).slice(0, 8))
    expect(await noOverflow(page), wide.join('\n')).toBe(true)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    expect(await noOverflow(page)).toBe(true)
  })
}
