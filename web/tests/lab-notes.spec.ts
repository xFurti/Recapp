import { expect, test, type Page } from '@playwright/test'
import { card, cardPage, info } from './lesson-fixture'
import type { Card, LabData } from '../src/types'

const notes = 'La tabella delle misure è nel quaderno.\nControllare la portata prima di usare il multimetro.'
const link = 'https://example.org/scheda-esperienza'
const oldLab: LabData = { goal: 'Confrontare le misure', repo_url: link, pitfall: 'Controllare la portata', bring: 'Multimetro' }
const emptyLab: LabData = { notes: '', repo_url: '', goal: '', pitfall: '', bring: '' }

async function setup(page: Page, { width = 1280, english = false, dark = false, legacy = false, scheduled = false, blank = false } = {}) {
  let saved: Card | null = scheduled ? null : {
    ...structuredClone(card), notes: '', attachments: [],
    entries: [{ ...card.entries[0], subject_code: 'TCI', lesson_status: 'svolta', attachment_ids: [],
      bullets: blank ? [] : ['Montato un circuito in serie e misurato tensione e corrente.'],
      lab: legacy ? oldLab : emptyLab }],
  }
  let writes = 0
  let publishes = 0
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(({ english, dark }) => {
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-03T14:00')
  }, { english, dark })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/cards/2026-10-02/publish')) {
      publishes++
      saved = { ...saved!, status: 'published', published_at: '2026-10-02T15:30:00' }
      await route.fulfill({ json: saved })
    } else if (path.endsWith('/cards/2026-10-02')) {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON()
        writes++
        saved = { ...card, ...body, revision: (saved?.revision ?? 0) + 1, attachments: [],
          items: body.items.map((item: Card['items'][number], index: number) => ({ ...item, id: item.id ?? index + 1, author: info.viewer.member, status: 'published', card_day: card.day })) }
        await route.fulfill({ json: saved })
      } else {
        const response = cardPage(saved ?? card)
        await route.fulfill({ json: { ...response, card: saved, next_lessons: { TCI: '2026-10-05' }, lessons: [{ subject_code: 'TCI', hours: [3, 4], hours_label: '3-4', room: 'L143', is_lab: true, start: '10:00', end: '12:00' }] } })
      }
    } else if (path.endsWith('/upcoming')) await route.fulfill({ json: saved?.status === 'published' ? saved.items : [] })
    else await route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto('/tests/lab-notes.html')
  await expect(page.getByRole('checkbox', { name: english ? 'Lab lesson' : 'Lezione in laboratorio' })).toBeChecked()
  return { saved: () => saved!, writes: () => writes, publishes: () => publishes }
}

for (const width of [1280, 320]) for (const english of [false, true]) for (const dark of [false, true]) {
  test(`${width}px ${english ? 'EN' : 'IT'} ${dark ? 'dark' : 'light'} optional notes/link, keyboard, autosave, reopen and publish`, async ({ page }) => {
    const { saved } = await setup(page, { width, english, dark })
    const area = page.getByRole('textbox', { name: english ? 'Lab notes' : 'Note di laboratorio', exact: true })
    const add = page.getByRole('button', { name: english ? 'Add a useful link' : 'Aggiungi un link utile' })
    await expect(area).toHaveValue('')
    await expect(page.getByRole('textbox', { name: english ? 'Useful link' : 'Link utile', exact: true })).toHaveCount(0)
    await area.fill(notes)
    await add.focus()
    await page.keyboard.press('Enter')
    const url = page.getByRole('textbox', { name: english ? 'Useful link' : 'Link utile', exact: true })
    await expect(url).toBeFocused()
    await url.fill(link)
    const remove = page.getByRole('button', { name: english ? 'Remove useful link' : 'Rimuovi link utile' })
    await page.keyboard.press('Tab')
    await expect(remove).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(add).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(url).toHaveValue('')
    await url.fill(link + '?version=2')
    await expect.poll(() => saved().entries[0].lab?.repo_url).toBe(link + '?version=2')
    expect(saved().entries[0].lab?.notes).toBe(notes)
    for (const field of [area, url]) {
      expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(width === 320 ? 16 : 15)
      const box = (await field.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.goto('/tests/lab-notes.html')
    await expect(area).toHaveValue(notes)
    await expect(url).toHaveValue(link + '?version=2')
    await page.getByRole('button', { name: english ? 'Preview' : 'Anteprima', exact: true }).click()
    await expect(page.getByRole('main').getByText(notes, { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /example.org\/scheda-esperienza/ })).toHaveAttribute('href', link + '?version=2')
    await page.getByRole('button', { name: english ? 'Publish' : 'Pubblica', exact: true }).click()
    await expect(page).toHaveURL(/\/giorno\/2026-10-02$/)
    await expect(page.getByRole('main').getByText(notes, { exact: true })).toBeVisible()
    const speech = await page.evaluate(async saved => {
      const module = '/src/components/day.tsx'
      const i18nModule = '/src/i18n.ts'
      const { speechText } = await import(module)
      const { default: i18n } = await import(i18nModule)
      return speechText(saved, [], i18n.t.bind(i18n), i18n.language)
    }, saved())
    expect(speech).toContain(notes)
    expect(speech).toContain(english ? 'A useful link is available' : 'È disponibile un link utile')
    expect(speech).not.toContain('https://')
  })
}

test('legacy contents combine once, remain editable and can be cleared without returning', async ({ page }) => {
  const { saved } = await setup(page, { legacy: true })
  const area = page.getByRole('textbox', { name: 'Note di laboratorio', exact: true })
  const combined = 'Obiettivo: Confrontare le misure\n\nTrappola: Controllare la portata\n\nCosa portare: Multimetro'
  await expect(area).toHaveValue(combined)
  await area.fill(combined + '\nMisure ricontrollate.')
  await expect.poll(() => saved().entries[0].lab?.notes).toBe(combined + '\nMisure ricontrollate.')
  expect(saved().entries[0].lab).toEqual({ ...emptyLab, notes: combined + '\nMisure ricontrollate.', repo_url: link })
  expect(saved().items).toEqual([])
  await page.goto('/tests/lab-notes.html')
  await expect(area).toHaveValue(combined + '\nMisure ricontrollate.')
  await area.focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await expect(area).toHaveValue('')
  await expect.poll(() => saved().entries[0].lab?.notes).toBe('')
  await page.goto('/tests/lab-notes.html')
  await expect(area).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Link utile', exact: true })).toHaveValue(link)
})

test('timetable initialises lab marker; marker and whitespace cannot publish an empty day', async ({ page }) => {
  const { publishes, writes } = await setup(page, { scheduled: true })
  const area = page.getByRole('textbox', { name: 'Note di laboratorio', exact: true })
  await expect(area).toHaveValue('')
  await area.fill('  \n  ')
  await page.getByRole('button', { name: 'Aggiungi un link utile' }).click()
  await page.getByRole('textbox', { name: 'Link utile', exact: true }).fill('   ')
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Aggiungi un contenuto prima di pubblicare' })).toBeVisible()
  expect(publishes()).toBe(0)
  await expect.poll(writes).toBeGreaterThan(0)
})

test('lesson points alone publish without empty note/link sections', async ({ page }) => {
  const { saved } = await setup(page)
  await page.getByRole('button', { name: 'Anteprima', exact: true }).click()
  await expect(page.getByRole('main').getByText('Note di laboratorio', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Link utile/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click()
  await expect(page).toHaveURL(/\/giorno\//)
  expect(saved().items).toHaveLength(0)
  await expect(page.getByRole('main').getByText('Montato un circuito in serie e misurato tensione e corrente.', { exact: true })).toBeVisible()
})

test('marker alone stays visible beside dated materials that reach Upcoming', async ({ page }) => {
  const { saved } = await setup(page, { blank: true })
  await page.getByRole('button', { name: 'Compito', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Cosa', { exact: true }).fill('Portare il multimetro e completare i calcoli')
  await dialog.locator('input[type="date"]').fill('2026-10-05')
  await dialog.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await page.getByRole('button', { name: 'Anteprima', exact: true }).click()
  await expect(page.getByRole('main').getByText('Note di laboratorio', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Link utile/ })).toHaveCount(0)
  await expect(page.getByRole('main').getByText('LAB', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click()
  await expect(page).toHaveURL(/\/giorno\//)
  expect(saved().items[0].due_date).toBe('2026-10-05')
  await page.getByRole('link', { name: 'In arrivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'In arrivo', exact: true })).toBeVisible()
  await expect(page.locator('main').getByText('Portare il multimetro e completare i calcoli', { exact: true })).toBeVisible()
})

for (const english of [false, true]) test(`${english ? 'EN' : 'IT'} share image keeps the lab badge`, async ({ page }) => {
  await page.addInitScript(() => {
    const drawn: string[] = []
    Object.assign(window, { drawn })
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      drawn.push(text)
      return maxWidth === undefined ? fill.call(this, text, x, y) : fill.call(this, text, x, y, maxWidth)
    }
  })
  await setup(page, { english })
  await page.getByRole('button', { name: english ? 'Publish' : 'Pubblica', exact: true }).click()
  await expect(page).toHaveURL(/\/giorno\//)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: english ? 'Share' : 'Condividi', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/\.png$/)
  const drawn = await page.evaluate(() => (window as unknown as { drawn: string[] }).drawn)
  expect(drawn).toContain(english ? 'Telecommunications · LAB' : 'Telecomunicazioni · LAB')
})
