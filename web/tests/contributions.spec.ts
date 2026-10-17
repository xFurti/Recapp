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

type Setup = { lang?: 'it' | 'en'; width?: number; dark?: boolean; data?: ContributionsInfo; failures?: number; cardAuthor?: typeof leo; thanksResponseError?: boolean }

async function setup(page: Page, { lang = 'it', width = 390, dark = false, data = full, failures = 0, cardAuthor = ada, thanksResponseError = false }: Setup = {}) {
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
      // The save succeeded, but the response was lost: the next read must reconcile it.
      if (thanksResponseError) return route.fulfill({ status: 500, json: { detail: 'Risposta interrotta' } })
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
  return Object.assign(calls, { update: (next: ContributionsInfo) => { contributions = structuredClone(next) }, recover: () => { failing = 0 } })
}

const T = {
  it: { link: 'Contributi della classe', title: 'Contributi della classe', streak: '5 giornate di fila', record: 'Record 7', days: 'Ultimi giorni di scuola', late: 'Recuperata', members: 'Partecipanti', period: 'Anno scolastico 2026/27', ranking: 'Grazie ricevuti', first: '1°', tied: 'a pari merito', firstTied: 'Primo posto a pari merito', third: '3°', me: 'Vai alla tua posizione', rules: 'Come contiamo', rule: 'entro mezzanotte', back: 'Classe', you: '(tu)' },
  en: { link: 'Class contributions', title: 'Class contributions', streak: '5 days in a row', record: 'Record 7', days: 'Latest school days', late: 'Caught up late', members: 'Members', period: 'School year 2026/27', ranking: 'Thanks received', first: '1st', tied: 'tied', firstTied: 'Tied for first place', third: '3rd', me: 'Go to your position', rules: 'How we count', rule: 'by midnight', back: 'Class', you: '(you)' },
}

const noOverflow = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

for (const lang of ['it', 'en'] as const) {
  for (const width of [320, 390, 1280]) {
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

for (const lang of ['it', 'en'] as const) for (const width of [320, 390, 1280]) for (const scale of [1, 2]) {
  test(`ranking content stays readable (${lang}, ${width}px, ${scale * 100}% text)`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setup(page, { lang, width, dark: lang === 'en', data: { ...full, ranking: ranking.map(r => ({ ...r, member: { ...r.member, nick: `${r.member.nick}NomeMoltoLungoSenzaSpazi` } })) } })
    await page.goto('/c/TEST/classe/contributi')
    const rows = page.getByRole('region', { name: T[lang].ranking }).getByRole('listitem')
    await expect(rows).toHaveCount(ranking.length)
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%` }, scale)
    await noOverflow(page)
    // Checking page overflow alone misses text overlapping another column or clipped by the list.
    const issues = await rows.evaluateAll(elements => elements.flatMap(element => {
      const row = element.getBoundingClientRect()
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      const boxes: { text: string; rect: DOMRect }[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim() || node.parentElement?.closest('.sr-only, svg')) continue
        if (node.parentElement?.closest('[aria-hidden="true"]') && !node.parentElement.closest('.contribution-count')) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) boxes.push({ text: node.textContent, rect })
        }
      }
      // Counters render through ::after. Include their real boxes and the visible labels,
      // rather than checking only the accessible text hidden by .sr-only.
      for (const number of element.querySelectorAll('.contribution-number')) {
        boxes.push({ text: number.getAttribute('data-value')!, rect: number.getBoundingClientRect() })
      }
      const clipped = boxes.filter(({ rect }) => rect.left < row.left - 1 || rect.right > row.right + 1 || rect.top < row.top - 1 || rect.bottom > row.bottom + 1)
      const overlaps = boxes.flatMap((a, index) => boxes.slice(index + 1).filter(b =>
        Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 &&
        Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1,
      ).map(b => `${a.text} / ${b.text}`))
      return [...clipped.map(({ text }) => `clipped: ${text}`), ...overlaps.map(text => `overlap: ${text}`)]
    }))
    expect(issues).toEqual([])
    const days = page.getByRole('list', { name: T[lang].days }).getByRole('listitem')
    const tiles = await days.evaluateAll(elements => elements.map(e => e.getBoundingClientRect().toJSON()))
    for (let i = 1; i < tiles.length; i++) {
      expect(tiles[i].top >= tiles[i - 1].bottom || tiles[i].left >= tiles[i - 1].right - 1).toBe(true)
    }
    const mine = page.locator('li[aria-current="true"]')
    await page.getByRole('button', { name: T[lang].me }).click()
    await expect(mine).toBeFocused()
  })
}

test('pending Grazie is shared between copies of an item and survives navigating away', async ({ page }) => {
  const calls = await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route('**/upcoming/1/thanks', async route => {
    requests++
    await gate
    await route.fallback()
  })
  await page.goto('/c/TEST')
  const name = /^Grazie per «Esercizi 1–5 pagina 112»/
  const buttons = page.getByRole('button', { name })
  await expect(buttons).toHaveCount(2)
  await buttons.first().click()
  await expect.poll(() => requests).toBe(1)
  for (const button of [buttons.first(), buttons.last()]) await expect(button).toHaveAttribute('aria-busy', 'true')
  await buttons.last().click()
  await page.keyboard.press('Space')
  // Another item remains independent while the first request is pending.
  const other = page.getByRole('button', { name: /^Grazie per «Ripasso derivate»/ })
  await other.click()
  await expect(other).toHaveText('4')
  await expect(other).not.toHaveAttribute('aria-busy', 'true')
  await page.locator('.section-nav-mobile').getByRole('link', { name: 'In arrivo' }).click()
  await expect(page).toHaveURL(/\/in-arrivo$/)
  await expect(buttons).toHaveCount(1)
  await expect(buttons).toHaveAttribute('aria-busy', 'true')
  await buttons.click()
  release()
  await expect(buttons).not.toHaveAttribute('aria-busy', 'true')
  await expect(buttons).toHaveAttribute('aria-pressed', 'true')
  await expect(buttons).toHaveText('1')
  expect(requests).toBe(1)
  expect(calls.thanks).toBe(2) // one per distinct item
  await buttons.click()
  await expect(buttons).toHaveAttribute('aria-pressed', 'false')
  await expect(buttons).not.toHaveAttribute('aria-busy', 'true')
  expect(requests).toBe(2)
})

test('a lost response after saving a Grazie reconciles all copies with the server', async ({ page }) => {
  const calls = await setup(page, { thanksResponseError: true })
  await page.goto('/c/TEST')
  const buttons = page.getByRole('button', { name: /^Grazie per «Esercizi 1–5 pagina 112»/ })
  await expect(buttons).toHaveCount(2)
  await buttons.first().click()
  await expect(page.getByRole('status').filter({ hasText: 'Risposta interrotta' })).toBeVisible()
  for (const button of [buttons.first(), buttons.last()]) {
    await expect(button).not.toHaveAttribute('aria-busy', 'true')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveText('1')
  }
  expect(calls.thanks).toBe(1)
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
  const calls = await setup(page, { failures: Number.MAX_SAFE_INTEGER })
  await page.goto('/c/TEST/classe')
  const card = page.locator('section[aria-labelledby="streak-card-title"]')
  await expect(card.getByRole('alert')).toContainText('Server non disponibile', { timeout: 15_000 })
  // Partecipanti stay usable while the streak fails.
  await expect(page.getByText('8 partecipanti')).toBeVisible()
  const beforeRetry = calls.contributions
  calls.recover()
  await card.getByRole('button', { name: 'Riprova' }).click()
  await expect(card.getByRole('heading', { name: '5 giornate di fila' })).toBeVisible()
  expect(calls.contributions).toBeGreaterThan(beforeRetry)
  await page.unroute('**/api/**')
  const next = await setup(page, { failures: Number.MAX_SAFE_INTEGER })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.getByRole('alert')).toContainText('Server non disponibile', { timeout: 15_000 })
  next.recover()
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
    await expect(buttons.first()).not.toHaveAttribute('aria-busy', 'true')
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

const podiumData = (rows: ContributionRow[]): ContributionsInfo => ({ ...full, ranking: rows, totals: totals(rows) })
const refresh = async (page: Page) => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
}

for (const size of [1, 2, 3]) {
  test(`podium with ${size} members uses only real steps and fills its width`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const rows = [row(1, 'Leo', 1, false, 8), row(2, 'Ada', 2, false, 5), row(3, 'Sara', 3, false, 3)].slice(0, size)
    await setup(page, { width: 320, data: podiumData(rows) })
    await page.goto('/c/TEST/classe/contributi')
    const podium = page.getByRole('group', { name: 'Il podio della classe' })
    await expect(podium.locator('.podium-step')).toHaveCount(size)
    await expect(page.locator('[data-contributor]')).toHaveCount(size)
    const boxes = await podium.evaluate(element => ({
      bounds: element.getBoundingClientRect().toJSON(),
      steps: Object.fromEntries(Array.from(element.querySelectorAll<HTMLElement>('[data-position]'), step => [step.dataset.position, step.getBoundingClientRect().toJSON()])),
    }))
    const { bounds, steps: { 1: first, 2: second, 3: third } } = boxes
    if (size !== 2) expect(Math.abs(first.x + first.width / 2 - bounds.x - bounds.width / 2)).toBeLessThan(2)
    else {
      expect(Math.abs(second.x - bounds.x)).toBeLessThan(2)
      expect(Math.abs(first.right - bounds.right)).toBeLessThan(2)
      expect(first.width).toBeCloseTo(second.width, 0)
    }
    if (size > 1) {
      expect(second.x).toBeLessThan(first.x)
      expect(second.y).toBeGreaterThan(first.y)
    }
    if (size > 2) expect(third.x).toBeGreaterThan(first.x)
    await page.getByRole('button', { name: 'Vai alla tua posizione' }).click()
    await expect(page.locator('#contributions-me')).toBeFocused()
    await noOverflow(page)
  })
}

test('a shared first place and third place fill two columns without a phantom step', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const rows = [row(2, 'Ada', 1, true, 8), row(3, 'Sara', 1, true, 8), row(1, 'Leo', 3, false, 5)]
  await setup(page, { width: 390, data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.locator('.podium-step')).toHaveCount(2)
  await expect(page.locator('[data-position="2"]')).toHaveCount(0)
  const bounds = await page.locator('.contribution-podium').boundingBox()
  const first = await page.locator('[data-position="1"]').boundingBox()
  const third = await page.locator('[data-position="3"]').boundingBox()
  expect(Math.abs(third!.x - bounds!.x)).toBeLessThan(2)
  expect(Math.abs(first!.x + first!.width - bounds!.x - bounds!.width)).toBeLessThan(2)
  expect(first!.width).toBeCloseTo(third!.width, 0)
  await noOverflow(page)
})

test('podium steps and crown animate once, settle, and stop when reduced motion is enabled', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { podiumAnimations: string[] }
    state.podiumAnimations = []
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'podium-rise' || event.animationName === 'podium-crown') state.podiumAnimations.push(event.animationName)
    })
  })
  await setup(page, { width: 1280, data: podiumData([row(1, 'Leo', 1, false, 8), row(2, 'Ada', 2, false, 5), row(3, 'Sara', 3, false, 3)]) })
  await page.goto('/c/TEST/classe/contributi')
  await expect.poll(() => page.evaluate(() => (window as unknown as { podiumAnimations: string[] }).podiumAnimations.sort())).toEqual(['podium-crown', 'podium-rise', 'podium-rise', 'podium-rise'])
  await page.locator('.contribution-podium').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished))
  })
  expect(await page.locator('.podium-step').evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element)
    return style.translate === '0px' || style.translate === '0px 0px'
  }))).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.contribution-podium').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  await expect(page.locator('#contributions-me .contribution-score-value')).toHaveText('8')
})

for (const rows of [
  [row(2, 'Ada', 1, true, 8), row(3, 'Sara', 1, true, 8), row(1, 'Leo', 3, false, 5), row(4, 'Marta', 4, false, 2)],
  [row(2, 'Ada', 1, false, 8), row(1, 'Leo', 2, true, 5), row(3, 'Sara', 2, true, 5), row(4, 'Marta', 4, false, 2)],
  [row(2, 'Ada', 1, false, 8), row(3, 'Sara', 2, false, 5), row(1, 'Leo', 3, true, 2), row(4, 'Marta', 3, true, 2)],
]) {
  test(`ties use actual positions without duplicates (${rows.map(r => r.position).join(',')})`, async ({ page }) => {
    await setup(page, { data: podiumData(rows) })
    await page.goto('/c/TEST/classe/contributi')
    await expect(page.locator('[data-contributor]')).toHaveCount(rows.length)
    for (const r of rows) {
      const target = page.locator(`[data-contributor="${r.member.id}"]`)
      await expect(target).toHaveCount(1)
      await expect(target).toHaveAttribute('value', String(r.position))
      if (r.position <= 3) await expect(target.locator('xpath=ancestor::*[@data-position][1]')).toHaveAttribute('data-position', String(r.position))
    }
    await page.getByRole('button', { name: 'Vai alla tua posizione' }).click()
    await expect(page.locator('#contributions-me')).toBeFocused()
  })
}

for (const width of [320, 1280]) test(`a large tied group stays compact, expands by keyboard and reveals your position (${width}px)`, async ({ page }) => {
  const rows = Array.from({ length: 24 }, (_, i) => row(i + 1, i === 0 ? 'Leo' : `Compagno${i}`, 1, true, 5))
  await setup(page, { width, lang: 'en', dark: true, data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  const group = page.locator('.podium-group')
  await expect(group).not.toHaveAttribute('open')
  await expect(group.getByText('24 members', { exact: true })).toBeVisible()
  await expect(page.locator('[data-contributor]')).toHaveCount(24)
  const summary = group.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(group).toHaveAttribute('open', '')
  await page.keyboard.press('Enter')
  await expect(group).not.toHaveAttribute('open')
  await page.getByRole('button', { name: 'Go to your position' }).click()
  await expect(group).toHaveAttribute('open', '')
  await expect(page.locator('#contributions-me')).toBeFocused()
  await noOverflow(page)
})

test('new publications advance the streak; a genuine record celebrates once across refetch, routes and reload', async ({ page }) => {
  const data: ContributionsInfo = structuredClone(full)
  const server = await setup(page, { data })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.getByRole('heading', { name: '5 giornate di fila' })).toBeVisible()
  await expect(page.locator('.streak-sparks')).toHaveCount(0)
  const advances: string[] = []
  // Observe even a short effect without timing assertions against screenshot capture.
  await page.exposeFunction('recordFeedback', (value: string) => advances.push(value))
  await page.evaluate(() => {
    new MutationObserver(records => records.forEach(record => {
      const value = (record.target as HTMLElement).dataset.feedback
      if (value) (window as unknown as { recordFeedback: (value: string) => void }).recordFeedback(value)
    })).observe(document.querySelector('.streak-panel')!, { attributes: true, attributeFilter: ['data-feedback'] })
  })
  data.streak.current = 6
  data.streak.days.at(-1)!.status = 'published'
  server.update(data)
  await refresh(page)
  await expect(page.getByRole('heading', { name: '6 giornate di fila' })).toBeVisible()
  await expect.poll(() => advances).toEqual(['advance'])
  data.streak.today = '2026-10-15'
  data.streak.days.push({ day: '2026-10-15', status: 'published' })
  data.streak.current = data.streak.record = 8
  server.update(data)
  await refresh(page)
  await expect(page.getByRole('heading', { name: '8 giornate di fila' })).toBeVisible()
  await expect.poll(() => advances).toEqual(['advance', 'record'])
  await expect(page.locator('.streak-sparks')).toBeVisible()
  await expect(page.locator('.streak-sparks')).toHaveCount(0)
  await refresh(page)
  await page.locator('main').getByRole('link', { name: 'Classe', exact: true }).click()
  await page.getByRole('link', { name: 'Contributi della classe' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: '8 giornate di fila' })).toBeVisible()
  await expect(page.locator('.streak-sparks')).toHaveCount(0)
  // A recalculated lower record returning to the same high watermark is not a new record.
  data.streak.record = data.streak.current = 6
  server.update(data)
  await refresh(page)
  await expect(page.getByRole('heading', { name: '6 giornate di fila' })).toBeVisible()
  data.streak.record = data.streak.current = 8
  server.update(data)
  await refresh(page)
  await expect(page.getByRole('heading', { name: '8 giornate di fila' })).toBeVisible()
  await expect(page.locator('.streak-sparks')).toHaveCount(0)
})

test('ranking updates move members between podium and list with the correct final counters', async ({ page }) => {
  const rows = [row(2, 'Ada', 1, false, 8), row(3, 'Sara', 2, false, 6), row(4, 'Marta', 3, false, 4), row(1, 'Leo', 4, false, 2)]
  const server = await setup(page, { data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.locator('[data-contributor]')).toHaveCount(4)
  await page.getByRole('button', { name: 'Vai alla tua posizione' }).click()
  await expect(page.locator('#contributions-me')).toBeFocused()
  const beforeY = await page.evaluate(() => {
    window.scrollTo({ top: 350, behavior: 'instant' })
    const state = window as unknown as { contributionMotion: { delta: number; finalY: number } | null }
    state.contributionMotion = null
    new MutationObserver(() => {
      const target = document.getElementById('contributions-me')
      if (!target || target.getAttribute('value') !== '1' || state.contributionMotion) return
      const flip = target.getAnimations().find(animation => (animation.effect as KeyframeEffect).getKeyframes()[0]?.transform)
      if (!flip) return
      const frame = (flip.effect as KeyframeEffect).getKeyframes()[0]
      state.contributionMotion = {
        delta: new DOMMatrix(String(frame.transform)).m42,
        finalY: target.getBoundingClientRect().y + scrollY - new DOMMatrix(getComputedStyle(target).transform).m42,
      }
    }).observe(document.querySelector('.contribution-ranking')!, { subtree: true, childList: true, attributes: true })
    return document.getElementById('contributions-me')!.getBoundingClientRect().y + scrollY
  })
  const promoted = [ { ...rows[3], position: 1, thanks: 10 }, ...rows.slice(0, 3).map(r => ({ ...r, position: r.position + 1 })) ]
  server.update(podiumData(promoted))
  await refresh(page)
  await expect(page.locator('#contributions-me')).toHaveAttribute('value', '1')
  await expect(page.locator('#contributions-me')).toBeFocused()
  const motion = await page.evaluate(() => (window as unknown as { contributionMotion: { delta: number; finalY: number } | null }).contributionMotion)
  expect(motion).not.toBeNull()
  expect(Math.abs(motion!.delta - (beforeY - motion!.finalY))).toBeLessThan(16)
  await expect(page.locator('[data-position="1"]')).toContainText('Leo')
  await expect(page.locator('[data-contributor]')).toHaveCount(4)
  await expect(page.locator('#contributions-me .contribution-number[data-value="10"]')).toHaveCount(1)
  await expect(page.locator('#contributions-me [aria-live]')).toHaveCount(0)
})

test('reduced motion shows final numbers and disables entrances, FLIP and record decorations, including a live preference change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const data = structuredClone(full)
  const server = await setup(page, { data, lang: 'en', dark: true, width: 320 })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.getByRole('heading', { name: '5 days in a row' })).toBeVisible()
  const count = page.locator('h2 .contribution-number').first()
  await expect(count).toHaveAttribute('data-value', '5')
  data.streak.current = data.streak.record = 8
  data.streak.days.at(-1)!.status = 'published'
  server.update(data)
  await refresh(page)
  await expect(count).toHaveAttribute('data-value', '8')
  await expect(page.locator('.streak-sparks')).toHaveCount(0)
  expect(await page.locator('.contribution-enter').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none'))).toBe(true)
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && (a.effect as KeyframeEffect).target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest('.contributions-page')).length)).toBe(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(count).toHaveAttribute('data-value', '8')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(count).toHaveAttribute('data-value', '8')
  await page.getByRole('button', { name: 'Go to your position' }).click()
  await expect(page.locator('#contributions-me')).toBeFocused()
})

test('members without Grazie stay in the list, even when fewer than three have any', async ({ page }) => {
  const rows = [row(2, 'Ada', 1, false, 3), row(3, 'Sara', 2, true, 0), row(1, 'Leo', 2, true, 0), row(4, 'Marta', 2, true, 0)]
  await setup(page, { data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  const podium = page.getByRole('group', { name: 'Il podio della classe' })
  await expect(podium.locator('.podium-step')).toHaveCount(1)
  await expect(podium.locator('[data-contributor]')).toHaveCount(1)
  await expect(podium.locator('[data-contributor="2"]')).toHaveCount(1)
  await expect(page.locator('[data-contributor]')).toHaveCount(4)
  for (const id of [1, 3, 4]) await expect(page.locator(`ol:not(.podium-members) > [data-contributor="${id}"]`)).toHaveAttribute('value', '2')
  await page.getByRole('button', { name: 'Vai alla tua posizione' }).click()
  await expect(page.locator('#contributions-me')).toBeFocused()
})

test('a ranking update does not pull focus back to a row the user already left', async ({ page }) => {
  const rows = [row(2, 'Ada', 1, false, 8), row(3, 'Sara', 2, false, 6), row(4, 'Marta', 3, false, 4), row(1, 'Leo', 4, false, 2)]
  const server = await setup(page, { width: 1280, data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  await page.getByRole('button', { name: 'Vai alla tua posizione' }).click()
  await expect(page.locator('#contributions-me')).toBeFocused()
  // Leaving the row without focusing anything else (e.g. a click on blank page) fires no focusin.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  server.update(podiumData([rows[0], rows[1], rows[2], { ...rows[3], thanks: 3 }]))
  await refresh(page)
  await expect(page.locator('#contributions-me .contribution-number[data-value="3"]')).toHaveCount(1)
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
})

test('the personal milestone uses the next distinct total and updates when sharing first place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const rows = [row(2, 'Ada', 1, false, 8), row(1, 'Leo', 2, true, 5), row(3, 'Nora', 2, true, 5), row(4, 'Milo', 4, false, 2)]
  const server = await setup(page, { data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  const goal = page.locator('.contribution-goal')
  await expect(goal).toContainText('3 Grazie per condividere il 1° posto.')
  const progress = goal.getByRole('progressbar', { name: 'Verso il 1° posto' })
  await expect(progress).toHaveAttribute('aria-valuenow', '5')
  await expect(progress).toHaveAttribute('aria-valuemax', '8')
  server.update(podiumData([{ ...rows[0], tied: true }, { ...rows[1], position: 1, thanks: 8 }, { ...rows[2], position: 3, tied: false }, rows[3]]))
  await refresh(page)
  await expect(goal).toContainText('La classe ti ringrazia')
  await expect(goal.getByRole('progressbar')).toHaveCount(0)
})

test('a zero-Grazie member has a real next milestone, while an all-zero class has no position target', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const rows = [row(2, 'Ada', 1, false, 8), row(3, 'Nora', 2, true, 1), row(4, 'Milo', 2, true, 1), row(1, 'Leo', 4, false, 0)]
  const server = await setup(page, { lang: 'en', width: 320, data: podiumData(rows) })
  await page.goto('/c/TEST/classe/contributi')
  const goal = page.locator('.contribution-goal')
  await expect(goal).toContainText('1 more thanks to share 2nd place.')
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  server.update(podiumData(rows.map(member => ({ ...member, thanks: 0, position: 1, tied: true }))))
  await refresh(page)
  await expect(goal).toContainText('The first thanks could be yours')
  await expect(goal.getByRole('progressbar')).toHaveCount(0)
  await expect(page.locator('.ranking-stage')).toHaveCount(0)
})

for (const width of [320, 1280]) test(`multi-digit statistics remain on one line in the actual page font (${width}px)`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setup(page, { width, data: podiumData([
    row(2, 'Ada', 1, false, 1207, 12, 24), row(1, 'Leo', 2, false, 111, 17, 21), row(3, 'Nora', 3, false, 31, 11, 120),
  ]) })
  await page.goto('/c/TEST/classe/contributi')
  await expect(page.locator('.podium-step')).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)
  const issues = await page.locator('.podium-member .contribution-number').evaluateAll(numbers => numbers.flatMap(number => {
    const style = getComputedStyle(number)
    const rect = number.getBoundingClientRect()
    const line = parseFloat(style.lineHeight)
    return rect.height > line + 1
      ? [`${number.getAttribute('data-value')} wrapped to ${rect.height}px (line ${line}px)`] : []
  }))
  expect(issues).toEqual([])
  await noOverflow(page)
})
