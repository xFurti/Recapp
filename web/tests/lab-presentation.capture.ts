import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { presentationSetup } from './lab-presentation-fixture'

const output = path.resolve('../docs/screenshots/issue-139')
async function readyImages(page: Page, viewer = false) {
  for (const img of await (viewer ? page.getByRole('dialog') : page.getByRole('main')).locator('img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await expect(img).toHaveCSS('opacity', '1')
  }
  if (viewer) await page.getByRole('dialog').evaluate(el => { el.scrollTop = 0 })
  else await page.evaluate(() => window.scrollTo(0, 0))
}

for (const width of [1280, 390, 320]) for (const english of [false, true]) for (const dark of [false, true]) {
  test(`day ${width} ${english ? 'en' : 'it'} ${dark ? 'dark' : 'light'}`, async ({ page }) => {
    await presentationSetup(page, { width, english, dark })
    await readyImages(page)
    await page.screenshot({ path: `${output}/after-${width}-${english ? 'en' : 'it'}-${dark ? 'dark' : 'light'}.png`, fullPage: true })
  })
}

for (const width of [1280, 390, 320]) for (const view of ['subject', 'editor', 'preview', 'viewer']) {
  test(`${view} ${width}`, async ({ page }) => {
    const english = width === 320, dark = width !== 1280
    await presentationSetup(page, { width, english, dark, view: view === 'viewer' ? 'day' : view === 'preview' ? 'editor' : view })
    if (view === 'preview') await page.getByRole('button', { name: english ? 'Preview' : 'Anteprima', exact: true }).click()
    if (view === 'viewer') await page.getByRole('main').getByRole('button', { name: english ? 'Open photo 2 of 3' : 'Apri foto 2 di 3', exact: true }).click()
    await readyImages(page, view === 'viewer')
    await page.screenshot({ path: `${output}/after-${view}-${width}-${english ? 'en' : 'it'}-${dark ? 'dark' : 'light'}.png`, fullPage: view !== 'viewer' })
  })
}

for (const english of [false, true]) test(`full address ${english ? 'en' : 'it'}`, async ({ page }) => {
  const width = english ? 320 : 390
  await presentationSetup(page, { width, english, dark: english })
  await page.locator('.lab-useful-link summary').click()
  await readyImages(page)
  await page.screenshot({ path: `${output}/after-address-${width}-${english ? 'en-dark' : 'it-light'}.png`, fullPage: true })
})

test('record gallery navigation', async ({ browser }) => {
  const context = await browser.newContext({ recordVideo: { dir: '/tmp/recapp139-video', size: { width: 390, height: 960 } } })
  const page = await context.newPage()
  await presentationSetup(page, { width: 390, dark: true })
  await page.getByRole('main').getByRole('button', { name: 'Apri foto 1 di 3', exact: true }).click()
  await readyImages(page, true)
  await page.waitForTimeout(700)
  await page.getByRole('dialog').getByRole('button', { name: 'Foto successiva', exact: true }).click()
  await readyImages(page, true)
  await page.waitForTimeout(700)
  await page.keyboard.press('ArrowRight')
  await readyImages(page, true)
  await page.waitForTimeout(700)
  await page.keyboard.press('ArrowLeft')
  await readyImages(page, true)
  await page.waitForTimeout(700)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('main').getByRole('button', { name: 'Apri foto 1 di 3', exact: true })).toBeFocused()
  await page.waitForTimeout(500)
  const video = page.video()!
  await context.close()
  await video.saveAs(`${output}/viewer-navigation.webm`)
})
