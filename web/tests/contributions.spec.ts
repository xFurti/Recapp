import { expect, test, type Page } from '@playwright/test'
import type { Card, ClassInfo, ContributionRow, ContributionsInfo, Item, MemberRow, TodayInfo } from '../src/types'

const leo = { id: 1, nick: 'Leo', color: '#1898C8' }
const ada = { id: 2, nick: 'Ada', color: '#A02848' }
const info: ClassInfo = {
  code: 'TEST', name: '4BI', label: '4ª BI · Informatica', is_demo: false,
  subjects: [{ code: 'MAT', name_it: 'Matematica', name_en: 'Math', color: '#E01058' }], hours: [],
  viewer: { kind: 'member', member: { ...leo, role: 'member' }, can_manage: false, read_only: false, tour_seen: true },
}

const row = (id: number, nick: string, position: number, tied: boolean, thanks: number, days = 1, items = 1): ContributionRow => ({
  position, tied, thanks, days_published: days, items_added: items, is_me: id === leo.id,
  member: { id, nick, color: ['#A02848', '#1898C8', '#80B830', '#8038B8'][id % 4] },
})
// A shared first place, and the viewer far from the top.
const ranking: ContributionRow[] = [
  row(3, 'luca', 1, true, 4, 2, 3), row(4, 'sara', 1, true, 4), row(5, 'marta', 3, false, 3), row(2, 'Ada', 4, false, 2),
  row(6, 'gianni', 5, true, 1), row(7, 'paolo', 5, true, 1), row(1, 'Leo', 7, true, 0, 0, 1), row(8, 'zoe', 7, true, 0, 0, 0),
]
const streak: ContributionsInfo['streak'] = {
  current: 5, record: 7, has_published: true, today: '2026-10-14',
  days: [
    { day: '2026-10-06', status: 'late' }, { day: '2026-10-07', status: 'published' }, { day: '2026-10-08', status: 'published' },
    { day: '2026-10-09', status: 'published' }, { day: '2026-10-12', status: 'published' }, { day: '2026-10-13', status: 'published' },
    { day: '2026-10-14', status: 'today_open' },
  ],
}
const period: ContributionsInfo['period'] = { kind: 'school_year', label: '2026/27', start: '2026-09-10', end: '2027-06-08' }
const totals = (rows: ContributionRow[]) => rows.reduce((sum, r) => ({
  thanks: sum.thanks + r.thanks, days_published: sum.days_published + r.days_published, items_added: sum.items_added + r.items_added,
}), { thanks: 0, days_published: 0, items_added: 0 })
const full: ContributionsInfo = { period, streak, ranking, totals: totals(ranking) }

const item = (id: number, title: string, author: typeof leo, extra: Partial<Item> = {}): Item => ({
  id, type: 'compito', subject_code: 'MAT', title, due_date: '2026-10-16', due_time: null, source: 'Classroom', link: '', attachment_id: null,
  author, status: 'published', card_day: '2026-10-14', thanks: 0, thanked: false, can_thank: author.id !== leo.id, ...extra,
})

type Setup = { lang?: 'it' | 'en'; width?: number; dark?: boolean; data?: ContributionsInfo; failures?: number; cardAuthor?: typeof leo }

async function setup(page: Page, { lang = 'it', width = 390, dark = false, data = full, failures = 0, cardAuthor = ada }: Setup = {}) {
  await page.setViewportSize({ width, height: 844 })
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-14T16:00')
  }, { lang, dark })
  // Server state: Grazie on items 1-3 and what the leaderboard reports for their author.
  const items: Record<number, Item> = {
    1: item(1, 'Esercizi 1–5 pagina 112', ada),
    2: item(2, 'Il mio compito', leo, { thanks: 2 }),
    3: item(3, 'Ripasso derivate', ada, { thanks: 3, card_day: null }),
  }
  let contributions = structuredClone(data)
  const calls = { thanks: 0, contributions: 0 }
  // Server errors are retried twice by React Query before the error state shows.
  let failing = failures
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api', '')
    const method = route.request().method()
    if (path === '/classes/TEST/contributions') {
      calls.contributions++
      if (failing > 0) {
        failing--
        return route.fulfill({ status: 500, json: { detail: lang === 'it' ? 'Server non disponibile' : 'Server unavailable' } })
      }
      return route.fulfill({ json: contributions })
    }
    const thanks = /^\/classes\/TEST\/upcoming\/(\d+)\/thanks$/.exec(path)
    if (thanks && method === 'POST') {
      calls.thanks++
      const target = items[Number(thanks[1])]
      if (!target.can_thank) return route.fulfill({ status: 403, json: { detail: 'Non puoi ringraziare un elemento che hai aggiunto tu' } })
      target.thanked = !target.thanked
      target.thanks += target.thanked ? 1 : -1
      contributions = { ...contributions, ranking: contributions.ranking.map(r => r.member.id === target.author!.id ? { ...r, thanks: r.thanks + (target.thanked ? 1 : -1) } : r) }
      return route.fulfill({ json: { ok: true, thanks: target.thanks, thanked: target.thanked } })
    }
    const card: Card = {
      id: 9, day: '2026-10-14', status: 'published', author: cardAuthor, updated_by: null, scribe: cardAuthor, notes: '', revision: 2,
      published_at: '2026-10-14T13:10:00Z', updated_at: '2026-10-14T13:10:00Z', attachments: [],
      entries: [{ subject_code: 'MAT', hours: '1', room: 'A1', is_lab: false, lesson_status: 'svolta', bullets: ['Derivate'], lab: null, attachment_ids: [] }],
      items: [items[1], items[2]],
    }
    const today: TodayInfo = {
      day: '2026-10-14', now: '2026-10-14T16:00:00+02:00', is_school_day: true, no_school_reason: '', status: 'published',
      scribe: cardAuthor, override_reason: null, is_me_scribe: false, has_draft: false, can_write: false, can_takeover: false, can_pass: false,
      takeover_at: '18:00', lessons: [], card, next_school_day: null, upcoming_soon: [items[1], items[3]], next_lessons: {}, open_corrections: 0,
    }
    const members: MemberRow[] = ranking.map(r => ({
      id: r.member.id, nick: r.member.nick, color: r.member.color, role: 'member', activated: true, needs_setup: false, rotation_order: r.member.id,
      is_today_scribe: false, days_written: r.days_published, items_added: r.items_added, is_me: r.is_me,
    }))
    const routes: Record<string, unknown> = {
      '/classes/TEST': info,
      '/me': { kind: 'member', member: info.viewer.member, classroom: info },
      '/classes/TEST/today': today,
      '/classes/TEST/members': { members, can_manage: false },
      '/classes/TEST/cards/2026-10-14/feedback': { thanks: 1, thanked: false, can_thank: cardAuthor.id !== leo.id, open_corrections: 0, comments: [] },
      '/classes/TEST/upcoming/corrections': { pending_count: 0, items: [] },
      '/classes/TEST/upcoming': url.searchParams.get('range') === 'past' ? [] : [items[1], items[3]],
    }
    return route.fulfill(path in routes ? { json: routes[path] } : { status: 404, json: { detail: `Unexpected test request: ${path}` } })
  })
  return calls
}

const T = {
  it: { link: 'Contributi della classe', title: 'Contributi della classe', streak: '5 giornate di fila', record: 'Record 7', days: 'Ultimi giorni di scuola', late: 'Recuperata', members: 'Partecipanti', period: 'Anno scolastico 2026/27', ranking: 'Grazie ricevuti', first: '1°', tied: 'a pari merito', firstTied: 'Primo posto a pari merito', third: '3°', me: 'Vai alla tua posizione', rules: 'Come contiamo', rule: 'entro mezzanotte', back: 'Classe', you: '(tu)' },
  en: { link: 'Class contributions', title: 'Class contributions', streak: '5 days in a row', record: 'Record 7', days: 'Latest school days', late: 'Caught up late', members: 'Members', period: 'School year 2026/27', ranking: 'Thanks received', first: '1st', tied: 'tied', firstTied: 'Tied for first place', third: '3rd', me: 'Go to your position', rules: 'How we count', rule: 'by midnight', back: 'Class', you: '(you)' },
}

const noOverflow = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

for (const lang of ['it', 'en'] as const) {
  for (const width of [390, 1280]) {
    const dark = lang === 'en' && width === 390
    test(`Classe card leads to Contributi with ties, own row and rules (${lang}, ${width}px${dark ? ', dark' : ''})`, async ({ page }) => {
      const t = T[lang]
      await setup(page, { lang, width, dark })
      await page.goto('/c/TEST/classe')
      const card = page.locator('section[aria-labelledby="streak-card-title"]')
      await expect(card.getByRole('heading', { name: t.streak })).toBeVisible()
      await expect(card).toContainText(t.record)
      const days = card.getByRole('list', { name: t.days })
      await expect(days.getByRole('listitem')).toHaveCount(7)
      // Each day carries its state in words, not only in color.
      await expect(days.getByRole('listitem').first()).toContainText(t.late)
      await expect(days.getByRole('listitem').last()).toHaveAttribute('data-status', 'today_open')
      await expect(page.getByRole('tab', { name: t.members })).toBeVisible()
      await noOverflow(page)

      const link = card.getByRole('link', { name: t.link })
      await link.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/c\/TEST\/classe\/contributi$/)
      await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeFocused()
      await expect(page.getByText(t.period, { exact: true })).toBeVisible()
      const list = page.getByRole('region', { name: t.ranking }).getByRole('listitem')
      await expect(list).toHaveCount(8)
      await expect(list.nth(0)).toContainText('luca')
      await expect(list.nth(1)).toContainText('sara')
      for (const index of [0, 1]) {
        await expect(list.nth(index)).toContainText(t.first)
        await expect(list.nth(index)).toContainText(t.tied)
        await expect(list.nth(index)).toContainText(t.firstTied)
      }
      await expect(list.nth(2)).toContainText(t.third)
      await expect(list.nth(2)).not.toContainText(t.tied)
      const mine = page.locator('li[aria-current="true"]')
      await expect(mine).toHaveCount(1)
      await expect(mine).toContainText('Leo')
      await expect(mine).toContainText(t.you)

      await page.getByRole('button', { name: t.me }).click()
      await expect(mine).toBeFocused()
      // Scrolled into view (smoothly), clear of the sticky header and of the phone tab bar.
      const limit = width < 768 ? (await page.locator('.tab-bar').boundingBox())!.y : 844
      const header = (await page.locator('header').first().boundingBox())!
      await expect.poll(async () => {
        const box = (await mine.boundingBox())!
        return box.y >= header.y + header.height && box.y + box.height <= limit
      }).toBe(true)

      const rules = page.getByRole('button', { name: t.rules })
      await expect(rules).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByText(t.rule)).toBeHidden()
      await rules.click()
      await expect(rules).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByText(t.rule)).toBeVisible()
      await noOverflow(page)

      await page.locator('main').getByRole('link', { name: t.back, exact: true }).click()
      await expect(page).toHaveURL(/\/c\/TEST\/classe$/)
      await expect(page.locator('[data-contributions-link]')).toBeFocused()
    })
  }
}

test('all at zero: no winner, no positions, contributions still counted', async ({ page }) => {
  const zero = ranking.map(r => ({ ...r, thanks: 0, position: 1, tied: true }))
  await setup(page, { data: { period, streak, ranking: zero, totals: totals(zero) } })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.getByText('Ancora nessun Grazie', { exact: true })).toBeVisible()
  const region = page.getByRole('region', { name: 'Grazie ricevuti' })
  await expect(region.locator('ol')).toHaveCount(0)
  await expect(region.getByRole('listitem')).toHaveCount(8)
  await expect(region).not.toContainText('Primo posto')
  await expect(region).not.toContainText('1°')
  await expect(region.getByRole('listitem').first()).toContainText('2 giornate pubblicate')
  await expect(page.getByText('0 Grazie, nessuna classifica per ora')).toBeVisible()
})

test('a class with nothing published yet invites to start, on Classe and in Contributi', async ({ page }) => {
  const zero = ranking.map(r => ({ ...r, thanks: 0, days_published: 0, items_added: 0, position: 1, tied: true }))
  const empty: ContributionsInfo = {
    period, ranking: zero, totals: totals(zero),
    streak: { current: 0, record: 0, has_published: false, today: '2026-10-14', days: [{ day: '2026-10-13', status: 'missed' }, { day: '2026-10-14', status: 'today_open' }] },
  }
  await setup(page, { lang: 'en', data: empty })
  await page.goto('/c/TEST/classe')
  await expect(page.getByRole('heading', { name: 'No days in a row yet' })).toBeVisible()
  await expect(page.getByText('Record 0')).toBeVisible()
  await expect(page.getByText('the class streak starts with the first one')).toBeVisible()
  await page.getByRole('link', { name: 'Class contributions' }).click()
  await expect(page.getByText('No contributions yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Thanks received' })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Latest school days' }).getByRole('listitem').first()).toContainText('Missed')
})

test('loading errors can be retried on the card and in the view', async ({ page }) => {
  const calls = await setup(page, { failures: 3 })
  await page.goto('/c/TEST/classe')
  const card = page.locator('section[aria-labelledby="streak-card-title"]')
  await expect(card.getByRole('alert')).toContainText('Server non disponibile', { timeout: 15_000 })
  // Partecipanti stay usable while the streak fails.
  await expect(page.getByText('8 partecipanti')).toBeVisible()
  await card.getByRole('button', { name: 'Riprova' }).click()
  await expect(card.getByRole('heading', { name: '5 giornate di fila' })).toBeVisible()
  expect(calls.contributions).toBe(4)
  await page.unroute('**/api/**')
  await setup(page, { failures: 3 })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.getByRole('alert')).toContainText('Server non disponibile', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Riprova' }).click()
  await expect(page.getByRole('region', { name: 'Grazie ricevuti' }).getByRole('listitem')).toHaveCount(8)
})

for (const width of [320, 390, 1280]) {
  test(`Grazie on an item: one counter in every view, keyboard toggle, never on your own content (${width}px)`, async ({ page }) => {
    const calls = await setup(page, { width })
    await page.goto('/c/TEST')
    // Item 1 is both in today's day and in "soon": two buttons, one counter.
    const buttons = page.getByRole('button', { name: /^Grazie per «Esercizi 1–5 pagina 112»/ })
    await expect(buttons).toHaveCount(2)
    await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false')
    await buttons.first().focus()
    await page.keyboard.press('Enter')
    for (const button of [buttons.first(), buttons.last()]) {
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(button).toHaveText('1')
    }
    await expect(buttons.first()).toBeFocused()
    await page.keyboard.press('Space')
    for (const button of [buttons.first(), buttons.last()]) {
      await expect(button).toHaveAttribute('aria-pressed', 'false')
      await expect(button).toHaveText('Grazie')
    }
    await page.keyboard.press('Enter')
    await expect(buttons.last()).toHaveAttribute('aria-pressed', 'true')
    expect(calls.thanks).toBe(3)

    // Your own item shows its Grazie, read-only; others' counts stay as they are.
    await expect(page.getByRole('button', { name: /Grazie per «Il mio compito»/ })).toHaveCount(0)
    await expect(page.getByText('2 grazie', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Grazie per «Ripasso derivate» · 3 grazie$/ })).toHaveText('3')
    // The day itself was published by Ada: its own Grazie button stays separate.
    await expect(page.getByRole('button', { name: /Ringrazia chi ha pubblicato la giornata · 1 grazie/ })).toBeVisible()

    // Next to the calendar action without overlapping, and no horizontal scrolling.
    const row = page.locator('div.rounded-xl', { has: page.getByText('Ripasso derivate', { exact: true }) }).last()
    const heart = (await row.getByRole('button', { name: /^Grazie per/ }).boundingBox())!
    const calendar = (await row.getByRole('button', { name: 'Aggiungi al calendario' }).boundingBox())!
    const apart = heart.x >= calendar.x + calendar.width || calendar.x >= heart.x + heart.width || heart.y >= calendar.y + calendar.height || calendar.y >= heart.y + heart.height
    expect(apart).toBe(true)
    expect(heart.height).toBeGreaterThanOrEqual(32)
    await noOverflow(page)

    // The leaderboard picks the new Grazie up when Contributi opens again.
    await page.goto('/c/TEST/classe/contributi')
    await expect(page.getByRole('region', { name: 'Grazie ricevuti' }).getByRole('listitem').filter({ hasText: 'Ada' })).toContainText('3')
  })
}

test('your own day shows its Grazie without a button', async ({ page }) => {
  await setup(page, { cardAuthor: leo })
  await page.goto('/c/TEST')
  await expect(page.getByRole('heading', { name: 'Risposte' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ringrazia chi ha pubblicato/ })).toHaveCount(0)
  await expect(page.getByText('1 grazie', { exact: true })).toBeVisible()
})

test('reduced motion: the heart still fills, without the burst', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setup(page, { lang: 'en', dark: true })
  await page.goto('/c/TEST/in-arrivo')
  const button = page.getByRole('button', { name: /^Thanks for “Ripasso derivate”/ })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(button).toHaveAttribute('data-liked', 'true')
  const animation = await button.locator('.t-like-icon').evaluate(el => getComputedStyle(el).animationName)
  expect(animation).toBe('none')
})
