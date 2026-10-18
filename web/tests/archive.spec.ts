import { expect, test, type Page } from '@playwright/test'
import { card, cardPage, info } from './lesson-fixture'

const days = Array.from({ length: 250 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10)
  return { day, author: info.viewer.member, updated_by: null, published_at: `${day}T13:00:00Z`,
    subjects: ['INI'], has_lab: index % 4 === 0, items: 0, missing: index % 11 === 0, has_draft: index % 22 === 0, can_write: true }
}).reverse()
const blocks = days.filter(day => !day.missing).flatMap(day => [0, 1].map(index => ({
  id: Number(day.day.replaceAll('-', '')) * 2 + index, day: day.day, author: info.viewer.member, updated_by: null,
  hours: index ? '5' : '1-2', room: '', is_lab: false, lesson_status: 'svolta',
  bullets: [`Lezione del ${day.day}: ${index ? 'Esercizi e approfondimenti' : 'Argomenti e attività svolte'}`],
  lab: null, attachment_ids: [], items: [],
})))

async function setup(page: Page, { width = 1280, english = false, dark = false, delay = 0 } = {}) {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ english, dark }) => {
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2027-06-15T10:00')
    document.addEventListener('click', event => {
      if ((event.target as Element).closest('a[href*="/giorno/"]')) Object.assign(window, { archiveDepartureY: scrollY })
    }, true)
  }, { english, dark })
  const state = { failNext: false, requests: [] as string[] }
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api', '')
    const params = url.searchParams
    if (path.endsWith('/cards') || /\/subjects\/[^/]+\/entries$/.test(path)) {
      state.requests.push(url.search)
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      if (params.has('cursor') && state.failNext) {
        state.failNext = false
        return route.fulfill({ status: 503, json: { detail: 'Pagina non disponibile, riprova.' } })
      }
      const data = path.endsWith('/cards') ? days : blocks
      const rows = data.filter(row => (!params.get('from_date') || row.day >= params.get('from_date')!) && (!params.get('to_date') || row.day <= params.get('to_date')!))
      const offset = Number(params.get('cursor') ?? 0)
      const limit = Number(params.get('limit') ?? 30)
      return route.fulfill({ json: { results: rows.slice(offset, offset + limit), next_cursor: offset + limit < rows.length ? String(offset + limit) : null } })
    }
    if (path === '/classes/TEST') return route.fulfill({ json: info })
    if (path === '/me') return route.fulfill({ json: { kind: 'member', member: info.viewer.member, classroom: info } })
    if (path.endsWith('/feedback')) return route.fulfill({ json: { thanks: 0, thanked: false, can_thank: false, open_corrections: 0, comments: [] } })
    if (/\/cards\/\d{4}-\d{2}-\d{2}$/.test(path)) return route.fulfill({ json: cardPage({ ...card, day: path.slice(-10), status: 'published', entries: [], items: [], attachments: [] }) })
    return route.fulfill({ json: { version: 'dev', releases: [], current: null } })
  })
  return state
}

const dayRows = (page: Page) => page.getByRole('list', { name: 'Giornate nello storico' }).locator(':scope > li')
const subjectRows = (page: Page) => page.getByRole('list', { name: 'Lezioni nello storico' }).locator(':scope > li')

test('all days are reachable; pending, next-page error, retry and end preserve existing results', async ({ page }) => {
  const state = await setup(page, { delay: 120 })
  await page.goto('/c/TEST/giorni')
  await expect(dayRows(page)).toHaveCount(30)
  state.failNext = true
  await page.getByRole('button', { name: 'Carica altre' }).click()
  await expect(dayRows(page)).toHaveCount(30)
  await expect(page.getByRole('button', { name: 'Carica altre' })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('Pagina non disponibile')
  await expect(dayRows(page)).toHaveCount(30)
  await page.getByRole('button', { name: 'Riprova', exact: true }).click()
  await expect(dayRows(page)).toHaveCount(60)
  for (let count = 60; count < days.length; count += 30) {
    const more = page.getByRole('button', { name: 'Carica altre' })
    await more.focus()
    await page.keyboard.press('Enter')
    await expect(dayRows(page)).toHaveCount(Math.min(count + 30, days.length))
  }
  const links = await dayRows(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')))
  expect(links).toEqual(days.map(day => `/c/TEST/giorno/${day.day}`))
  await expect(page.getByText(`Fine dei risultati · ${days.length} caricati`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Carica altre' })).toHaveCount(0)
})

test('all subject blocks beyond 80 remain reachable and stable', async ({ page }) => {
  await setup(page)
  await page.goto('/c/TEST/materia/INI?period=all')
  await expect(subjectRows(page)).toHaveCount(30)
  for (let count = 30; count < blocks.length; count += 30) {
    await page.getByRole('button', { name: 'Carica altre' }).click()
    await expect(subjectRows(page)).toHaveCount(Math.min(count + 30, blocks.length))
  }
  const text = await subjectRows(page).locator('ul li').allTextContents()
  expect(text).toEqual(blocks.map(block => block.bullets[0]))
  await expect(page.getByText(`Fine dei risultati · ${blocks.length} caricati`)).toBeVisible()
})

test('month, inclusive range and missing days share filters; subjects inherit the archive period', async ({ page }) => {
  await setup(page)
  await page.goto('/c/TEST/giorni')
  await page.getByLabel('Periodo', { exact: true }).selectOption('month')
  await page.getByLabel('Mese', { exact: true }).fill('2026-12')
  await expect(dayRows(page)).toHaveCount(30)
  await page.getByRole('button', { name: 'Carica altre' }).click()
  await expect(dayRows(page)).toHaveCount(31)
  await expect(dayRows(page).filter({ hasText: 'Non pubblicata' })).not.toHaveCount(0)
  await page.getByRole('button', { name: 'Mese successivo' }).click()
  await expect(page.getByLabel('Mese', { exact: true })).toHaveValue('2027-01')
  await page.goBack()
  await expect(page.getByLabel('Mese', { exact: true })).toHaveValue('2026-12')
  await expect(dayRows(page)).toHaveCount(31)
  await page.getByRole('button', { name: 'Per materia', exact: true }).click()
  await page.getByRole('option', { name: info.subjects[0].name_it }).click()
  await expect(page).toHaveURL(/materia\/INI\?period=month&month=2026-12$/)
  await expect(page.getByLabel('Mese', { exact: true })).toHaveValue('2026-12')
  await page.getByRole('link', { name: 'Torna alla vista generale' }).click()
  await expect(dayRows(page)).toHaveCount(31)
  await page.getByLabel('Periodo', { exact: true }).selectOption('custom')
  await page.getByLabel('Dal', { exact: true }).fill('2026-12-07')
  await page.getByLabel('Al', { exact: true }).fill('2026-12-09')
  await page.getByRole('button', { name: 'Applica intervallo' }).click()
  await expect(dayRows(page)).toHaveCount(3)
  expect(await dayRows(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['2026-12-09', '2026-12-08', '2026-12-07'].map(day => `/c/TEST/giorno/${day}`))
  await page.reload()
  await expect(dayRows(page)).toHaveCount(3)
  await page.getByLabel('Dal', { exact: true }).fill('2027-01-01')
  await expect(page.getByRole('button', { name: 'Applica intervallo' })).toBeDisabled()
})

for (const subject of [false, true]) test(`reload, day return and Back/Forward restore pages, filters and position (${subject ? 'subject' : 'days'})`, async ({ page }) => {
  await setup(page, { width: 390, delay: 50 })
  const path = subject ? '/c/TEST/materia/INI?period=all' : '/c/TEST/giorni?period=all'
  const rows = subject ? subjectRows(page) : dayRows(page)
  await page.goto(path)
  await expect(rows).toHaveCount(30)
  await page.getByRole('button', { name: 'Carica altre' }).click()
  await expect(rows).toHaveCount(60)
  const row = rows.nth(45)
  await row.scrollIntoViewIfNeeded()
  const original = page.url()
  await row.getByRole('link').last().click()
  await expect(page).toHaveURL(/\/giorno\//)
  const y = await page.evaluate(() => (window as unknown as { archiveDepartureY: number }).archiveDepartureY)
  await page.goBack()
  await expect(rows).toHaveCount(60)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0)
  await page.reload()
  await expect(rows).toHaveCount(60)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0)
  await rows.nth(45).getByRole('link').last().click()
  await page.getByRole('link', { name: 'Torna ai risultati' }).click()
  await expect(page).toHaveURL(original)
  await expect(rows).toHaveCount(60)
  await page.goBack()
  await expect(page).toHaveURL(/\/giorno\//)
  await page.goForward()
  await expect(rows).toHaveCount(60)
})

for (const width of [320, 390, 1280]) for (const english of [false, true]) test(`controls fit ${width}px ${english ? 'English dark' : 'Italian light'}`, async ({ page }) => {
  await setup(page, { width, english, dark: english })
  for (const path of ['/c/TEST/giorni', '/c/TEST/materia/INI']) {
    await page.goto(path + '?period=custom&from=2026-12-07&to=2026-12-09')
    await expect(page.getByLabel(english ? 'From' : 'Dal', { exact: true })).toHaveValue('2026-12-07')
    await expect(page.getByText(english ? /End of results/ : /Fine dei risultati/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const input of await page.locator('main input, main select').all()) {
      const box = (await input.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      if (width < 768) expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    }
    await page.getByLabel(english ? 'Period' : 'Periodo', { exact: true }).selectOption('month')
    await page.getByLabel(english ? 'Month' : 'Mese', { exact: true }).fill('2026-09')
    await expect(page.getByText(english ? /End of results|results loaded/ : /Fine dei risultati|risultati caricati/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('a failed page during reload keeps the saved context until retry completes it', async ({ page }) => {
  const state = await setup(page, { delay: 40 })
  await page.goto('/c/TEST/giorni?period=all&pages=3')
  await expect(dayRows(page)).toHaveCount(90)
  await dayRows(page).nth(80).scrollIntoViewIfNeeded()
  const y = await page.evaluate(() => scrollY)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem(`recapp.archive.position:${location.pathname}${location.search}`))).toBe(String(y))
  state.failNext = true
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Pagina non disponibile')
  await expect(dayRows(page)).toHaveCount(30)
  await page.getByRole('button', { name: 'Riprova', exact: true }).click()
  await expect(dayRows(page)).toHaveCount(90)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0)
})

test('empty, invalid and first-page error states have a way back', async ({ page }) => {
  await setup(page)
  await page.goto('/c/TEST/giorni?period=custom&to=2020-01-01')
  await expect(dayRows(page)).toHaveCount(0)
  await expect(page.getByText('Fine dei risultati · 0 caricati')).toBeVisible()
  await page.goto('/c/TEST/giorni?period=custom&from=2027-02-31')
  await expect(page.getByRole('alert')).toContainText('Inserisci date valide')
  await page.getByLabel('Periodo', { exact: true }).selectOption('all')
  await expect(dayRows(page)).toHaveCount(30)
  await page.route('**/api/classes/TEST/cards?**', route => route.fulfill({ status: 503, json: { detail: 'Storico non disponibile' } }))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Storico non disponibile')
  await page.unroute('**/api/classes/TEST/cards?**')
  await page.getByRole('button', { name: 'Riprova' }).click()
  await expect(dayRows(page)).toHaveCount(30)
})
