import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Card, Draft, Item, TodayInfo } from '../src/types'
import { card, cardPage, info } from './lesson-fixture'

const nextLessons = { INI: '2026-10-05' }
const legacy: Item = {
  id: 41, type: 'compito', subject_code: 'INI', title: 'Legacy homework',
  due_date: '2026-10-03', due_time: '15:30', source: 'Classroom',
  link: 'https://example.com/homework', attachment_id: 9, author: info.viewer.member,
  status: 'published', card_day: card.day, can_edit: true,
}
const drafts: Draft[] = ['Imported lab', 'Imported test'].map((title, index) => ({
  type: index === 0 ? 'lab' : 'verifica', subject_code: 'INI', title,
  due_date: '2026-10-05', due_time: '16:45', source: 'Campus',
  needs_check: false, check_reason: '',
}))

async function setup(page: Page, { view = 'upcoming', width = 1280, dark = false, english = false } = {}) {
  let upcoming = [structuredClone(legacy)]
  let saved = { ...structuredClone(card), items: [structuredClone(legacy)] }
  const writes: { method: string; body: Partial<Item> }[] = []
  const cardWrites: unknown[] = []
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(({ dark, english }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    localStorage.setItem('ieri.simulatedNow', '2026-10-02T14:00')
  }, { dark, english })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/today')) {
      const today: TodayInfo = {
        ...cardPage(saved).state, now: '2026-10-02T14:00', lessons: [], card: null,
        next_school_day: null, upcoming_soon: upcoming, next_lessons: nextLessons, open_corrections: 0,
      }
      await route.fulfill({ json: today })
    } else if (path.includes('/upcoming')) {
      if (request.method() === 'GET') await route.fulfill({ json: upcoming })
      else {
        const body = request.postDataJSON() as Partial<Item>
        writes.push({ method: request.method(), body })
        const item = { ...legacy, ...body, id: request.method() === 'PATCH' ? legacy.id : 42 + writes.length }
        upcoming = request.method() === 'PATCH' ? [item] : [...upcoming, item]
        await route.fulfill({ json: item })
      }
    } else if (path.endsWith(`/cards/${card.day}`)) {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as Pick<Card, 'entries' | 'notes' | 'items'> & { attachment_ids: number[] }
        cardWrites.push(body)
        saved = {
          ...saved, ...body, revision: saved.revision + 1,
          items: body.items.map((item, index) => ({ ...legacy, ...item, id: item.id ?? 50 + index })),
          attachments: body.attachment_ids.map(id => ({ id, width: 1, height: 1 })),
        }
        await route.fulfill({ json: saved })
      } else await route.fulfill({ json: { ...cardPage(saved), next_lessons: nextLessons } })
    } else if (path.endsWith('/ocr')) await route.fulfill({ json: { job_id: 'item-dates' } })
    else if (path.endsWith('/ocr/item-dates')) await route.fulfill({ json: { status: 'done', drafts, message: '', provider: 'test' } })
    else if (path.includes('/attachments/')) await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHioAAAAASUVORK5CYII=', 'base64') })
    else await route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto(`/tests/item-dates.html?view=${view}`)
  await expect(page.locator('main').getByText(legacy.title, { exact: true })).toBeVisible()
  return { writes, cardWrites, saved: () => saved }
}

async function checkDateRow(dialog: Locator, width: number) {
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0)
  const date = dialog.locator('input[type="date"]')
  await expect(date).toBeVisible()
  const bounds = await date.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
  const sizes = await date.evaluate(element => ({
    input: element.getBoundingClientRect().width,
    row: element.parentElement!.getBoundingClientRect().width,
  }))
  expect(Math.abs(sizes.input - sizes.row)).toBeLessThanOrEqual(1)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
}

for (const width of [320, 390, 1280]) for (const dark of [false, true]) for (const english of [false, true]) {
  test(`all item types use a full-width date: ${width}px, ${dark ? 'dark' : 'light'}, ${english ? 'en' : 'it'}`, async ({ page }, testInfo) => {
    const { writes } = await setup(page, { width, dark, english })
    await expect(page.locator('html')).toHaveAttribute('lang', english ? 'en' : 'it')
    await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /^(?!.*dark)/)
    const labels = english ? ['Homework', 'Test', 'Event', 'Lab'] : ['Compito', 'Verifica', 'Evento', 'Lab']
    const types = ['compito', 'verifica', 'evento', 'lab']
    for (const [index, label] of labels.entries()) {
      await page.getByRole('button', { name: english ? 'Add' : 'Aggiungi', exact: true }).filter({ visible: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: label, exact: true }).click()
      await checkDateRow(dialog, width)
      await dialog.getByLabel(english ? 'What' : 'Cosa', { exact: true }).fill(`Date-only ${types[index]}`)
      await dialog.getByRole('combobox', { name: english ? 'Subject' : 'Materia', exact: true }).selectOption('INI')
      const date = dialog.locator('input[type="date"]')
      await expect(date).toHaveValue('2026-10-05')
      if (index === 0) {
        const path = testInfo.outputPath('item-form.png')
        await dialog.screenshot({ path })
        await testInfo.attach('item form', { path, contentType: 'image/png' })
      }
      await dialog.getByRole('button', { name: english ? 'Tomorrow' : 'Domani', exact: true }).click()
      await expect(date).toHaveValue('2026-10-03')
      await dialog.getByRole('button', { name: english ? 'In a week' : 'Tra una settimana', exact: true }).click()
      await expect(date).toHaveValue('2026-10-09')
      await dialog.getByRole('button', { name: english ? /Next lesson/ : /Prossima lezione/ }).click()
      await expect(date).toHaveValue('2026-10-05')
      await date.fill('2026-10-12')
      await dialog.getByRole('button', { name: english ? 'Add' : 'Aggiungi', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      expect(writes[index]).toMatchObject({ method: 'POST', body: { type: types[index], due_date: '2026-10-12', due_time: null } })
      const row = page.locator('main').getByRole('button', { name: `Date-only ${types[index]}`, exact: true }).locator('../..')
      await expect(row).not.toContainText(/\d{2}:\d{2}/)
    }
  })
}

test('editing legacy homework clears its time and Today shows only the date', async ({ page }) => {
  const { writes } = await setup(page, { width: 390 })
  const row = page.locator('main').getByRole('button', { name: legacy.title, exact: true }).locator('../..')
  await expect(row).toContainText('Domani')
  await expect(row).not.toContainText(legacy.due_time!)
  await page.getByRole('button', { name: legacy.title, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Modifica elemento' })
  await checkDateRow(dialog, 390)
  await expect(dialog.locator('input[type="date"]')).toHaveValue(legacy.due_date)
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toEqual([{ method: 'PATCH', body: {
    type: legacy.type, subject_code: legacy.subject_code, title: legacy.title,
    due_date: legacy.due_date, due_time: null, source: legacy.source, link: legacy.link,
  } }])
  await page.goto('/tests/item-dates.html?view=today')
  const todayRow = page.locator('main').getByRole('button', { name: legacy.title, exact: true }).locator('../..')
  await expect(todayRow).toContainText('Domani')
  await expect(todayRow).not.toContainText(/\d{2}:\d{2}/)
})

test('editor autosave clears legacy times while preserving lesson and attachment data', async ({ page }) => {
  const { saved, cardWrites } = await setup(page, { view: 'editor', width: 320, dark: true })
  expect(cardWrites).toHaveLength(0)
  await page.locator('input[value="API e database"]').fill('API e database aggiornati')
  await expect.poll(() => saved().items[0].due_time).toBeNull()
  expect(saved().items[0]).toMatchObject({ ...legacy, due_time: null })
  expect(saved().entries[0]).toEqual({ ...card.entries[0], bullets: ['API e database aggiornati'] })
  expect(saved().entries[1]).toEqual(card.entries[1])
  expect(saved().attachments).toEqual(card.attachments)
  await page.getByRole('button', { name: /Legacy homework/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Modifica elemento' })
  await checkDateRow(dialog, 320)
  await dialog.locator('input[type="date"]').fill('2026-10-06')
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect.poll(() => saved().items[0].due_date).toBe('2026-10-06')
  expect(saved().items[0].due_time).toBeNull()
  await page.getByRole('button', { name: 'Anteprima', exact: true }).click()
  const row = page.getByRole('button', { name: legacy.title, exact: true }).locator('../..')
  await expect(row).not.toContainText(/\d{2}:\d{2}/)
})

test('imported times are hidden and cleared on both direct acceptance and editing', async ({ page }) => {
  const { saved } = await setup(page, { view: 'editor', width: 390, english: true })
  await page.locator('textarea').first().fill('Campus: lab and test at 16:45')
  await page.getByRole('button', { name: 'Read with AI', exact: true }).click()
  const importedLab = page.getByRole('listitem').filter({ hasText: 'Imported lab' })
  const importedTest = page.getByRole('listitem').filter({ hasText: 'Imported test' })
  await expect(importedLab).toBeVisible()
  await expect(importedLab).not.toContainText('16:45')
  await expect(importedTest).not.toContainText('16:45')
  await importedLab.getByRole('button', { name: 'Add', exact: true }).click()
  await importedTest.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New test' })
  await checkDateRow(dialog, 390)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect.poll(() => saved().items.length).toBe(3)
  expect(saved().items.map(item => item.due_time)).toEqual([null, null, null])
  for (const draft of drafts) expect(saved().items.find(item => item.title === draft.title)).toMatchObject({
    type: draft.type, subject_code: draft.subject_code, title: draft.title,
    due_date: draft.due_date, due_time: null, source: draft.source,
  })
})
