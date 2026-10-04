import { expect, test, type Page } from '@playwright/test'

const stage = (page: Page) => page.getByRole('application', { name: 'La fuga di Magilla, un minigioco' })
const score = (page: Page) => page.locator('.mg-stage .font-mono > span.text-ink')

async function open(page: Page, query = '') {
  await page.addInitScript(() => localStorage.setItem('ieri.lang', 'it'))
  await page.goto(`/tests/magilla.html${query}`)
  await expect(stage(page)).toBeVisible()
  await expect(page.getByText('Premi Spazio per aiutare Magilla a scappare')).toBeVisible()
}

test('Space starts the run and the score climbs', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Space')
  await expect(page.getByText('Premi Spazio per aiutare Magilla a scappare')).toHaveCount(0)
  await expect.poll(async () => Number(await score(page).textContent())).toBeGreaterThan(3)
})

test('crashing shows the catchphrase, saves the best score and restarts', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Space')
  const again = page.getByRole('button', { name: 'Gioca ancora' })
  await expect(again).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('“Ci riproveremo la settimana prossima!”')).toBeVisible()
  const best = await page.evaluate(() => Number(localStorage.getItem('recapp.magilla.best')))
  expect(best).toBeGreaterThan(0)
  await expect(page.getByText(/^Preso con \d+ punti/)).toBeAttached()
  await again.click()
  await expect(again).toHaveCount(0)
  await expect(page.getByText(`REC${String(best).padStart(5, '0')}`)).toBeVisible()
})

test('Escape pauses and Space resumes', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await expect(page.getByText('In pausa', { exact: true })).toBeVisible()
  const frozen = await score(page).textContent()
  await page.waitForTimeout(400)
  await expect(score(page)).toHaveText(frozen!)
  await page.keyboard.press('Space')
  await expect(page.getByText('In pausa', { exact: true })).toHaveCount(0)
})

test('keys pressed on other controls are left alone', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Outside' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Premi Spazio per aiutare Magilla a scappare')).toBeVisible()
})

test('sound toggle is remembered', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Disattiva i suoni' }).click()
  await expect(page.getByRole('button', { name: 'Attiva i suoni' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('recapp.magilla.sound'))).toBe('off')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Attiva i suoni' })).toBeVisible()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('tap to start, hold the pad to duck', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ieri.lang', 'it'))
    await page.goto('/tests/magilla.html')
    await expect(page.getByText('Tocca per aiutare Magilla a scappare')).toBeVisible()
    await stage(page).tap()
    const pad = page.getByRole('button', { name: 'Abbassati' })
    await expect(pad).toBeVisible()
    const box = (await pad.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(375)
  })
})

test('dark theme and reduced motion render without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '?dark')
  await page.keyboard.press('Space')
  await expect.poll(async () => Number(await score(page).textContent())).toBeGreaterThan(2)
  expect(errors).toEqual([])
})
