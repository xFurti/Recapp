import { expect, test, type Page } from '@playwright/test'

const message = 'Ricordate il repository per il laboratorio. '
const longMessage = message.repeat(18)
async function setup(page: Page, query = '') {
  let comments = [
    { id: 1, kind: 'correction', body: longMessage, resolved: false, author: { id: 1, nick: 'Ada', color: '#a02848' }, created_at: '2026-10-01T10:00:00Z', mine: true },
    { id: 2, kind: 'comment', body: 'Grazie per il riepilogo!', resolved: false, author: { id: 2, nick: 'Leo', color: '#1898c8' }, created_at: '2026-10-01T10:05:00Z', mine: false },
    { id: 3, kind: 'comment', body: 'Il mio secondo messaggio.', resolved: false, author: { id: 1, nick: 'Ada', color: '#a02848' }, created_at: '2026-10-01T10:10:00Z', mine: true },
  ]
  let deletes = 0
  let fail = false
  let release: (() => void) | undefined
  let hold = false
  await page.route('**/api/**', async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes++
      if (hold) await new Promise<void>((resolve) => { release = resolve })
      if (fail) return route.fulfill({ status: 500, json: { detail: 'Server unavailable' } })
      const id = Number(route.request().url().split('/').pop())
      comments = comments.filter((c) => c.id !== id)
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: { thanks: 2, thanked: false, open_corrections: comments.filter(c => c.kind === 'correction').length, comments } })
  })
  page.on('dialog', () => { throw new Error('Unexpected browser confirmation') })
  await page.goto(`/tests/feedback.html${query}`)
  await expect(page.getByRole('button', { name: 'Elimina', exact: true })).toHaveCount(2)
  return { deletes: () => deletes, fail: (value: boolean) => { fail = value }, hold: () => { hold = true }, release: () => release?.() }
}
const open = (page: Page) => page.getByRole('button', { name: 'Elimina', exact: true }).first().click()

for (const close of ['cancel', 'close', 'escape', 'backdrop']) {
  test(`dismiss with ${close} preserves data and restores focus`, async ({ page }) => {
    const state = await setup(page)
    const trigger = page.getByRole('button', { name: 'Elimina', exact: true }).first()
    await open(page)
    const dialog = page.getByRole('dialog', { name: 'Eliminare questo messaggio?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(longMessage, { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Annulla' })).toBeFocused()
    expect(state.deletes()).toBe(0)
    if (close === 'cancel') await dialog.getByRole('button', { name: 'Annulla' }).click()
    if (close === 'close') await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click()
    if (close === 'escape') await page.keyboard.press('Escape')
    if (close === 'backdrop') await page.mouse.click(2, 2)
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(state.deletes()).toBe(0)
    await expect(page.locator('li')).toHaveCount(3)
  })
}

test('keyboard focus stays in the dialog and background is inert', async ({ page }) => {
  await setup(page)
  await open(page)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  }
  await page.getByPlaceholder('Scrivi un messaggio…').evaluate((element: HTMLInputElement) => element.focus())
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
})

test('explicit confirmation sends one request, blocks dismissal, updates and focuses conversation', async ({ page }) => {
  const state = await setup(page)
  state.hold()
  await open(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Elimina messaggio' }).click()
  await expect(dialog.getByRole('button', { name: 'Eliminazione…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Annulla' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Chiudi', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.mouse.click(2, 2)
  await dialog.getByRole('button', { name: 'Eliminazione…' }).evaluate((element: HTMLButtonElement) => { element.click(); element.click() })
  await expect(dialog).toBeVisible()
  expect(state.deletes()).toBe(1)
  state.release()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('li')).toHaveCount(2)
  await expect(page.getByRole('status')).toHaveText('Messaggio eliminato')
  await expect(page.getByRole('heading', { name: 'Risposte' })).toBeFocused()
})

test('failed deletion preserves message and allows retry or closing', async ({ page }) => {
  const state = await setup(page)
  state.fail(true)
  await open(page)
  await page.getByRole('button', { name: 'Elimina messaggio' }).click()
  await expect(page.getByRole('alert')).toContainText('Non è stato possibile eliminare')
  await expect(page.locator('li')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Annulla' })).toBeFocused()
  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await open(page)
  await page.getByRole('button', { name: 'Elimina messaggio' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  state.fail(false)
  await page.getByRole('button', { name: 'Elimina messaggio' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.deletes()).toBe(3)
})

test('preview and deletion refer to the selected message; ownership remains enforced', async ({ page }) => {
  const state = await setup(page, '?readonly')
  await expect(page.locator('li').nth(1).getByRole('button', { name: 'Elimina' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Elimina', exact: true }).nth(1).click()
  await expect(page.getByRole('dialog')).toContainText('Il mio secondo messaggio.')
  await page.getByRole('button', { name: 'Elimina messaggio' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('li').first()).toContainText(longMessage)
  expect(state.deletes()).toBe(1)
})

for (const dark of [false, true]) {
  for (const mobile of [false, true]) {
    test(`layout ${dark ? 'dark' : 'light'} ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 360, height: 640 } : { width: 1280, height: 800 })
      await setup(page, dark ? '?dark' : '')
      await open(page)
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const bounds = await dialog.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(16)
      expect(bounds!.y).toBeGreaterThanOrEqual(16)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(mobile ? 344 : 1264)
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await expect(dialog.getByRole('button', { name: 'Elimina messaggio' })).toBeInViewport()
      expect(await dialog.locator('p').nth(1).evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
    })
  }
}

test('English and reduced motion retain accessible labels and dismissal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setup(page)
  await page.evaluate(() => localStorage.setItem('ieri.lang', 'en'))
  await page.reload()
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Delete this message?' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  expect(await dialog.evaluate(el => getComputedStyle(el).transform)).toBe('none')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('record interaction for issue 19', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, recordVideo: { dir: testInfo.outputPath('video') } })
  const page = await context.newPage()
  const state = await setup(page)
  await open(page)
  await page.waitForTimeout(650)
  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  state.fail(true)
  await open(page)
  await page.getByRole('button', { name: 'Elimina messaggio' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.waitForTimeout(800)
  state.fail(false)
  state.hold()
  await page.getByRole('button', { name: 'Elimina messaggio' }).click()
  await page.waitForTimeout(800)
  state.release()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(800)
  await context.close()
  await testInfo.attach('interaction', { path: (await page.video()!.path()), contentType: 'video/webm' })
})
