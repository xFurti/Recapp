import { expect, test, type Page } from '@playwright/test'
import type { Item, ItemCorrection } from '../src/types'

const original: Item = { id: 10, type: 'compito', subject_code: 'MAT', title: 'Esercizi 1–5 pagina 112', due_date: '2026-10-13', due_time: '09:30', source: 'Classroom', link: 'https://example.org/homework', attachment_id: 7, author: { id: 1, nick: 'author', color: '#A02848' }, status: 'published', card_day: '2026-10-09' }
const request = (id: number, member = 2, proposed: ItemCorrection['proposed'] = { title: 'Esercizi 1–10 pagina 112', due_date: '2026-10-14' }): ItemCorrection => ({
  id, item_id: 10, author: { id: member, nick: member === 2 ? 'student' : 'other', color: '#1898C8' }, proposed, reason: 'La docente ha assegnato anche gli esercizi 6–10.', status: 'pending', decided_by: null, decided_at: null, decision_note: '', already_fixed: false, created_at: '2026-10-12T13:00:00Z', updated_at: '2026-10-12T13:00:00Z', mine: member === 2,
})

async function setup(page: Page, { role = 'student', initial = [] as ItemCorrection[], width = 1280, dark = false, english = false, demo = false, failSend = false, failDecision = false, latency = 0 } = {}) {
  const item = structuredClone(original)
  const requests = structuredClone(initial)
  const memberId = role === 'author' ? 1 : role === 'admin' ? 4 : role === 'other' ? 3 : 2
  const review = role === 'author' || role === 'admin'
  const posts: unknown[] = []
  let decisions = 0
  const metadata = (it: Item) => ({ ...it, can_edit: review, can_request_correction: it.due_date >= '2026-10-12' && role !== 'author', can_review_corrections: review,
    pending_corrections: review ? requests.filter(r => r.status === 'pending').length : 0,
    correction_count: review ? requests.length : 0,
    my_correction: it.id === 10 ? requests.filter(r => r.author.id === memberId).map(r => ({ id: r.id, status: r.status })).at(-1) ?? null : null,
  })
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(({ dark, english }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    localStorage.setItem('ieri.simulatedNow', '2026-10-12T15:30')
    localStorage.setItem('recapp.tour.demo', '1')
  }, { dark, english })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    if (path === '/api/classes/TEST/upcoming/10/corrections' && method === 'POST') {
      posts.push(route.request().postDataJSON())
      if (latency) await new Promise(resolve => setTimeout(resolve, latency))
      if (failSend) { failSend = false; await route.fulfill({ status: 500, json: { detail: 'Temporary failure' } }); return }
      const body = route.request().postDataJSON() as { proposed: ItemCorrection['proposed']; reason: string }
      let pending = requests.find(r => r.author.id === memberId && r.status === 'pending')
      if (!pending) { pending = request(requests.length + 1, memberId); requests.push(pending) }
      Object.assign(pending, body)
      await route.fulfill({ json: pending })
    } else if (path === '/api/classes/TEST/upcoming/10/corrections') {
      await route.fulfill({ json: { item: metadata(item), can_review: review, requests: requests.filter(r => review || r.author.id === memberId).map(r => ({ ...r, mine: r.author.id === memberId })) } })
    } else if (path.endsWith('/decide')) {
      decisions++
      if (latency) await new Promise(resolve => setTimeout(resolve, latency))
      if (failDecision) { failDecision = false; await route.fulfill({ status: 500, json: { detail: 'Temporary failure' } }); return }
      const id = Number(path.split('/').at(-2))
      const selected = requests.find(r => r.id === id)!
      const body = route.request().postDataJSON()
      if (body.action === 'accept') Object.assign(item, selected.proposed)
      selected.status = body.action === 'reject' ? 'rejected' : 'accepted'
      selected.already_fixed = body.action === 'already_fixed'
      selected.decision_note = body.note
      selected.decided_by = { id: memberId, nick: role, color: '#A02848' }
      selected.decided_at = '2026-10-12T13:10:00Z'
      await route.fulfill({ json: selected })
    } else if (path === '/api/classes/TEST/upcoming/corrections') {
      const count = review ? requests.filter(r => r.status === 'pending').length : 0
      await route.fulfill({ json: { pending_count: count, items: count ? [{ item: metadata(item), pending_count: count }] : [] } })
    } else if (path === '/api/classes/TEST/upcoming') {
      await route.fulfill({ json: url.searchParams.get('range') === 'past' ? [metadata({ ...item, id: 11, title: 'Elemento passato', due_date: '2026-10-09' })] : [metadata(item)] })
    } else if (path.endsWith('/today')) {
      await route.fulfill({ json: { day: '2026-10-12', now: '2026-10-12T15:30', status: 'no_school', is_school_day: false, no_school_reason: 'weekend', lessons: [], scribe: null, card: null, next_school_day: null, upcoming_soon: [metadata(item)], next_lessons: {}, open_corrections: 0 } })
    } else if (path === '/api/classes/TEST/upcoming/10' && method === 'PATCH') {
      Object.assign(item, route.request().postDataJSON()); await route.fulfill({ json: metadata(item) })
    } else await route.fulfill({ json: { version: 'dev', status: 'idle', stored: true } })
  })
  await page.goto(`/tests/item-corrections.html?role=${role}&demo=${demo}`)
  await expect(page.getByRole('heading', { name: english ? 'Upcoming' : 'In arrivo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: original.title, exact: true })).toBeVisible()
  return { item, requests, posts, decisions: () => decisions }
}

test('student sends sparse fields, keeps errors editable and replaces their pending request', async ({ page }) => {
  const state = await setup(page, { initial: [request(99, 3)], failSend: true, latency: 250 })
  const report = page.getByRole('button', { name: 'Segnala un errore', exact: true })
  await report.click()
  const form = page.getByRole('dialog', { name: 'Segnala un errore' })
  await expect(form.locator('input[type=time]')).toHaveCount(0)
  await expect(form.getByLabel('Cosa', { exact: true })).toHaveValue(original.title)
  await form.getByLabel('Cosa', { exact: true }).fill('Esercizi 1–10 pagina 112')
  const send = form.getByRole('button', { name: 'Invia richiesta' })
  await expect(send).toBeDisabled()
  await form.getByLabel('Motivo', { exact: true }).fill('   ')
  await expect(send).toBeDisabled()
  await form.getByLabel('Motivo', { exact: true }).fill('Sono dieci esercizi')
  await send.click()
  await expect(send).toBeDisabled()
  await expect(form.getByRole('alert')).toBeVisible()
  await expect(form.getByLabel('Cosa', { exact: true })).toHaveValue('Esercizi 1–10 pagina 112')
  await send.click()
  await expect(page.getByRole('dialog', { name: 'Richieste di correzione' })).toBeVisible()
  await expect(page.getByText('other', { exact: true })).toHaveCount(0)
  expect(state.posts.at(-1)).toEqual({ proposed: { title: 'Esercizi 1–10 pagina 112' }, reason: 'Sono dieci esercizi' })
  await page.getByRole('button', { name: 'Modifica la tua richiesta' }).click()
  await form.getByLabel('Cosa', { exact: true }).fill('Esercizi 1–12 pagina 112')
  await form.getByRole('button', { name: 'Aggiorna richiesta' }).click()
  await expect(page.getByRole('dialog', { name: 'Richieste di correzione' })).toBeVisible()
  expect(state.requests).toHaveLength(2)
  expect(state.requests.at(-1)!.proposed).toEqual({ title: 'Esercizi 1–12 pagina 112' })
  expect(state.item.author).toEqual(original.author)
})

test('author compares only differences; accepting leaves the second request open on updated data', async ({ page }) => {
  const state = await setup(page, { role: 'author', initial: [request(1), request(2, 3, { title: 'Esercizi 1–20 pagina 112' })], latency: 250 })
  await expect(page.getByRole('button', { name: 'Segnala un errore', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '2 richieste in attesa', exact: true }).click()
  const panel = page.getByRole('dialog')
  const first = panel.getByRole('region', { name: 'Richiesta di student' })
  await expect(first.locator('dt')).toHaveText(['Cosa', 'Quando'])
  await first.getByRole('button', { name: 'Accetta', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Accetta', exact: true }).last()).toBeDisabled()
  await expect(first.getByText('Accettata', { exact: true })).toBeVisible()
  const other = panel.getByRole('region', { name: 'Richiesta di other' })
  await expect(other.getByText('Esercizi 1–10 pagina 112', { exact: true })).toBeVisible()
  await expect(other.getByText('In attesa', { exact: true })).toBeVisible()
  expect(state.decisions()).toBe(1)
  expect(state.item.author).toEqual(original.author)
  expect(state.item.attachment_id).toBe(7)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'Oggi', exact: true }).click()
  await expect(page.getByRole('button', { name: '1 richiesta di correzione da controllare' })).toBeVisible()
  await page.getByRole('button', { name: '1 richiesta di correzione da controllare' }).click()
  await page.locator('ul').getByRole('button', { name: /Esercizi 1–10 pagina 112/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('admin rejects with a note, retries errors, and still edits normally', async ({ page }) => {
  const state = await setup(page, { role: 'admin', initial: [request(1)], failDecision: true })
  await page.getByRole('button', { name: '1 richiesta in attesa', exact: true }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Nota per lo studente (facoltativa)').fill('Controllato sul registro')
  await panel.getByRole('button', { name: 'Rifiuta', exact: true }).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  await panel.getByRole('button', { name: 'Rifiuta', exact: true }).click()
  await expect(panel.getByText('Rifiutata', { exact: true })).toBeVisible()
  expect(state.item).toMatchObject(original)
  expect(state.requests[0].decision_note).toBe('Controllato sul registro')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: original.title, exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Modifica elemento' })).toBeVisible()
})

test('already matching request closes without rewriting and requester can inspect rejection', async ({ page }) => {
  const matching = request(1, 2, { title: original.title })
  const state = await setup(page, { role: 'author', initial: [matching] })
  await page.getByRole('button', { name: '1 richiesta in attesa', exact: true }).click()
  await page.getByRole('button', { name: 'Chiudi come già sistemata' }).click()
  await expect(page.getByRole('dialog').getByText('Già sistemata', { exact: true })).toBeVisible()
  expect(state.item).toMatchObject(original)
  await page.unroute('**/api/**')
  const rejected = { ...request(2), status: 'rejected' as const, decision_note: 'Il registro conferma il giorno', decided_by: original.author, decided_at: '2026-10-12T13:10:00Z' }
  await setup(page, { initial: [rejected, request(3, 3)] })
  await page.getByRole('button', { name: 'La tua richiesta è stata rifiutata' }).click()
  await expect(page.getByRole('dialog').getByText(rejected.decision_note)).toBeVisible()
  await expect(page.getByRole('dialog').getByText('other', { exact: true })).toHaveCount(0)
})

test('320px English dark review shows all six changed fields without overflow', async ({ page }) => {
  const proposal = request(1, 2, { type: 'lab', subject_code: null, title: 'Bring the computer', due_date: '2026-10-14', source: 'Campus', link: 'https://example.org/' + 'a'.repeat(420) })
  const state = await setup(page, { role: 'author', width: 320, dark: true, english: true, initial: [proposal] })
  await page.getByRole('button', { name: '1 pending request', exact: true }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.locator('dt')).toHaveCount(6)
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const cell of await panel.locator('dd > div').all()) {
    expect(await cell.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  const note = panel.getByLabel('Note for the student (optional)')
  expect(await note.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
  await note.fill('The original item is correct.')
  await panel.getByRole('button', { name: 'Reject', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(panel.getByText('Rejected', { exact: true })).toBeVisible()
  expect(state.item).toMatchObject(original)
})

for (const width of [320, 390, 1280]) for (const dark of [false, true]) {
  test(`${width}px ${dark ? 'dark' : 'light'} ${dark ? 'English official' : 'Italian demo'} keyboard, layout and date-only proposal`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setup(page, { width, dark, english: dark, demo: !dark })
    const report = page.getByRole('button', { name: dark ? 'Report an error' : 'Segnala un errore', exact: true })
    await report.focus()
    await page.keyboard.press('Enter')
    const panel = page.getByRole('dialog')
    await expect(panel).toBeVisible()
    await expect(panel.locator('input[type=time]')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.position)).toBe('fixed')
    for (const control of await panel.locator('input,select,textarea').all()) {
      await control.focus()
      const bounds = await control.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      if (width < 640) expect(await control.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    }
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    const cancel = panel.getByRole('button', { name: dark ? 'Cancel' : 'Annulla' })
    await cancel.focus()
    await page.keyboard.press('Tab')
    await expect(panel.getByRole('button', { name: dark ? 'Close' : 'Chiudi', exact: true })).toBeFocused()
    // A shortened viewport exercises the same sizing path used by the keyboard.
    if (width < 640) {
      await page.setViewportSize({ width, height: 430 })
      await cancel.scrollIntoViewIfNeeded()
      const bounds = await cancel.boundingBox()
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(430)
    }
    await page.keyboard.press('Escape')
    await expect(report).toBeFocused()
    expect(await page.evaluate(() => document.body.style.position)).toBe('')
    await page.getByRole('button', { name: dark ? 'Show past' : 'Mostra passati', exact: true }).click()
    const past = page.getByRole('button', { name: 'Elemento passato', exact: true }).locator('..')
    await expect(past.getByRole('button', { name: dark ? 'Report an error' : 'Segnala un errore' })).toHaveCount(0)
  })
}

test('a trailing space alone cannot be sent and a conflict explains how to recover', async ({ page }) => {
  const state = await setup(page)
  await page.route('**/api/classes/TEST/upcoming/10/corrections', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 409, json: { detail: 'La richiesta è appena cambiata.' } })
    else await route.fallback()
  })
  await page.getByRole('button', { name: 'Segnala un errore', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Segnala un errore' })
  await form.getByLabel('Cosa', { exact: true }).fill(`${original.title} `)
  await form.getByLabel('Motivo', { exact: true }).fill('Spazio in più')
  const send = form.getByRole('button', { name: 'Invia richiesta' })
  await expect(send).toBeDisabled()
  await form.getByLabel('Cosa', { exact: true }).fill('Esercizi 1–10 pagina 112')
  await send.click()
  await expect(form.getByRole('alert')).toContainText('Chiudi e riapri il pannello')
  expect(state.posts).toHaveLength(0)
})

test('accepted request keeps showing what changed, focus stays in the dialog and the note is sent', async ({ page }) => {
  const state = await setup(page, { role: 'author', initial: [request(1)] })
  await page.getByRole('button', { name: '1 richiesta in attesa', exact: true }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Nota per lo studente (facoltativa)').fill('Grazie, corretto')
  await panel.getByRole('button', { name: 'Accetta', exact: true }).click()
  await expect(panel.getByText('Accettata', { exact: true })).toBeVisible()
  expect(state.requests[0].decision_note).toBe('Grazie, corretto')
  await expect(panel.locator('dt')).toHaveText(['Cosa', 'Quando'])
  await expect(panel.locator('dd').first()).toContainText('Esercizi 1–10 pagina 112')
  await expect(panel.getByText('Valore attuale')).toHaveCount(0)
  await page.keyboard.press('Tab')
  expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true)
})
