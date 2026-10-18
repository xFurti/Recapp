import { expect, test, type Page } from '@playwright/test'
import { classes, fixture, release, reports } from './support-fixture'

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const headerOverlap = await page.locator('.support-brand a, .support-brand button').evaluateAll(elements => {
    const boxes = elements.map(el => el.getBoundingClientRect())
    return boxes.some((box, i) => boxes.slice(i + 1).some(other => Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 && Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1))
  })
  expect(headerOverlap).toBe(false)
  const clipped = await page.locator('main h1, main h2, main h3, .support-description, .support-report-row, .school-class, .school-class-stats > div, .report-kind-option, .report-field-label, .report-counter, .report-status, .creator-step-controls, .faq-answer[data-open="true"]').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => `${el.tagName}.${el.className}: ${el.textContent?.slice(0, 80)}`))
  expect(clipped).toEqual([])
}

for (const width of [320, 390, 1280]) for (const lang of ['it', 'en']) for (const theme of ['light', 'dark']) for (const enlarged of [false, true]) {
  test(`support layouts ${width} ${lang} ${theme} ${enlarged ? '200%' : '100%'}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(({ lang, theme }) => {
      localStorage.setItem('ieri.lang', lang)
      localStorage.setItem('ieri.theme', theme)
    }, { lang, theme })
    await fixture(page, 'owner')
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const path of ['/faq', '/novita', '/segnala', '/scuola']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      if (enlarged) await page.evaluate(() => document.documentElement.style.fontSize = '200%')
      if (path === '/faq') {
        await page.locator('h3 button').first().focus()
        await page.keyboard.press('Enter')
        await expect(page.locator('.faq-answer[data-open="true"]')).toBeVisible()
      }
      if (path === '/scuola') {
        await expect(page.locator('.school-class')).toHaveCount(12)
        await page.locator('.school-class h3').first().evaluate(el => el.textContent = 'UnaClasseConUnNomeMoltoLungoSenzaSpazi'.repeat(3))
        if (width === 1280) {
          const starts = await page.locator('.school-class-stats').evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().x)))
          expect(new Set(starts).size).toBe(1)
        }
      }
      if (path === '/novita') {
        expect(await page.locator('.release-entry').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
        await page.getByRole('button', { name: lang === 'it' ? 'Filtra per data' : 'Filter by date' }).click()
        await expect(page.locator('#news-dates')).toHaveAttribute('data-open', 'true')
        expect((await page.locator('header').boundingBox())!.height).toBeLessThan(600)
      }
      await fits(page)
    }
    expect(errors).toEqual([])
  })
}

test('report validation, category keyboard navigation, submission and member-only list', async ({ page }) => {
  await fixture(page, 'member')
  await page.addInitScript(() => localStorage.setItem('ieri.lang', 'it'))
  await page.goto('/segnala')
  await expect(page.locator('#my-reports')).toBeVisible()
  await page.getByRole('button', { name: 'Invia segnalazione' }).click()
  const title = page.getByRole('textbox', { name: 'Titolo', exact: true })
  const body = page.getByRole('textbox', { name: 'Descrizione', exact: true })
  await expect(title).toBeFocused()
  await expect(title).toHaveAttribute('aria-invalid', 'true')
  await title.fill('Un titolo di prova')
  await page.getByRole('button', { name: 'Invia segnalazione' }).click()
  await expect(body).toBeFocused()
  await body.fill('Descrizione di prova sufficientemente completa.')
  await page.getByRole('radio', { name: 'Bug', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Funzionalità', exact: true })).toBeChecked()
  let payload = ''
  await page.route('**/api/reports', route => {
    payload = route.request().postData() ?? ''
    return route.fulfill({ json: { ...reports[0], id: 77, title: 'Un titolo di prova', kind: 'feature' } })
  })
  await page.getByRole('button', { name: 'Invia segnalazione' }).click()
  await expect(page.locator('.report-sent')).toBeFocused()
  expect(payload).toContain('name="kind"\r\n\r\nfeature')
  expect(payload).toContain('Un titolo di prova')
  await expect(page.locator('.report-row[data-fresh="true"]')).toContainText('Un titolo di prova')
  await page.getByRole('button', { name: 'Scrivine un’altra' }).click()
  await expect(title).toBeFocused()
  await fixture(page, 'anonymous')
  await page.reload()
  await expect(page.locator('#my-reports')).toHaveCount(0)
})

test('school report filters, status mutation, focus restoration and class actions', async ({ page }) => {
  await fixture(page, 'owner')
  await page.addInitScript(() => localStorage.setItem('ieri.lang', 'it'))
  await page.goto('/scuola')
  await expect(page.locator('.school-class')).toHaveCount(12)
  const firstClass = page.locator('.school-class').first()
  await expect(firstClass.locator('a')).toHaveAttribute('href', `/c/${classes[0].code}`)
  await expect(firstClass.locator('dd')).toHaveText(['Ven 16 ott', '5', '24 / 26'])
  const requested: string[] = []
  await page.route('**/api/owner/reports?*', route => {
    requested.push(new URL(route.request().url()).searchParams.get('demo')!)
    return route.fulfill({ json: reports })
  })
  await page.getByRole('tab', { name: 'Senza demo' }).click()
  await expect.poll(() => requested).toContain('hide')
  const opener = page.getByRole('button', { name: `Apri la segnalazione: ${reports[0].title}` })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  let status = ''
  await page.route('**/api/owner/reports/1', route => {
    status = route.request().postDataJSON().status
    return route.fulfill({ json: { ...reports[0], status } })
  })
  await dialog.getByRole('radio', { name: 'Chiusa', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect.poll(() => status).toBe('closed')
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
  await page.getByRole('button', { name: 'Crea classe', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Crea classe' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Calendario scolastico/ }).click()
  await expect(page.getByRole('textbox', { name: 'Motivo' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Tipo di giorno' })).toBeVisible()
})

test('public school login and FAQ anchors keep their destinations', async ({ page }) => {
  await fixture(page)
  await page.addInitScript(() => localStorage.setItem('ieri.lang', 'en'))
  await page.goto('/scuola')
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible()
  await expect(page.locator('.school-class')).toHaveCount(0)
  await page.goto('/faq')
  const team = page.locator('h3 button').last()
  await team.focus()
  await page.keyboard.press('Space')
  await page.locator('a[href="#creators"]').click()
  await expect(page).toHaveURL(/#creators$/)
  const heading = page.locator('#creators')
  await expect(heading).toBeInViewport()
  expect((await heading.boundingBox())!.y).toBeGreaterThan((await page.locator('header').boundingBox())!.height)
  await page.goto(`/novita?q=unmatched#release-${release.id}`)
  await expect(page.getByRole('button', { name: release.title.en })).toHaveAttribute('aria-expanded', 'true')
})

test('report attachment errors and server failure keep the draft available', async ({ page }) => {
  await fixture(page, 'member')
  await page.addInitScript(() => localStorage.setItem('ieri.lang', 'it'))
  await page.goto('/segnala')
  const image = page.locator('input[type=file]')
  await image.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('test') })
  await expect(image).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Il file scelto non è un’immagine.')).toBeVisible()
  await image.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxWQAAAAASUVORK5CYII=', 'base64') })
  await expect(page.getByText('test.png')).toBeVisible()
  await page.getByRole('button', { name: 'Togli l’immagine' }).click()
  await expect(page.getByText('test.png')).toHaveCount(0)
  await expect(image).toBeAttached()
  await page.getByRole('textbox', { name: 'Titolo', exact: true }).fill('Segnalazione con un errore di rete')
  await page.getByRole('textbox', { name: 'Descrizione', exact: true }).fill('Il testo deve restare disponibile per riprovare.')
  await page.route('**/api/reports', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }))
  await page.getByRole('button', { name: 'Invia segnalazione' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Titolo', exact: true })).toHaveValue('Segnalazione con un errore di rete')
})

test('school report dialog keeps a long title and status controls usable at 200%', async ({ page }) => {
  await fixture(page, 'owner')
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/scuola')
  await expect(page.locator('.school-class')).toHaveCount(12)
  await page.evaluate(() => document.documentElement.style.fontSize = '200%')
  await page.locator('button.support-report-row').first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const title = await dialog.locator('h2').first().boundingBox()
  expect(title!.height).toBeLessThan(450)
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  const last = dialog.getByRole('radio').last()
  await last.focus()
  await expect(last).toBeFocused()
  await expect(last.locator('..')).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
