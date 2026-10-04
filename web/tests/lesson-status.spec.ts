import { expect, test, type Page } from '@playwright/test'
import { card, cardPage } from './lesson-fixture'
import type { Card } from '../src/types'

async function setup(page: Page, { mobile = false, dark = false, english = false } = {}) {
  let saved = structuredClone(card)
  let saves = 0
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.addInitScript(({ dark, english }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
  }, { dark, english })
  await page.route('**/api/**', async route => {
    const request = route.request()
    if (request.url().includes('/attachments/')) {
      await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHioAAAAASUVORK5CYII=', 'base64') })
    } else if (request.url().includes('/cards/2026-10-02/publish')) {
      saved = { ...saved, status: 'published', published_at: '2026-10-02T15:30:00' }
      await route.fulfill({ json: saved })
    } else if (request.url().includes('/cards/2026-10-02')) {
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON() as Pick<Card, 'entries' | 'notes' | 'items'> & { attachment_ids: number[] }
        saved = { ...saved, entries: payload.entries, notes: payload.notes, items: payload.items, attachments: payload.attachment_ids.map(id => ({ id, width: 1, height: 1 })), revision: saved.revision + 1 }
        saves++
        await route.fulfill({ json: saved })
      } else await route.fulfill({ json: cardPage(saved) })
    } else await route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto('/tests/lesson-status.html')
  const group = page.getByRole('group', { name: english ? /Lesson status · Computer science/ : /Stato della lezione · Informatica/ })
  await expect(group).toBeVisible()
  return { group, saved: () => saved, saves: () => saves }
}

test('saved state, autosave, reopening, preview and publication preserve all lesson content', async ({ page }) => {
  const { group, saved, saves } = await setup(page)
  await expect(group.getByRole('radio', { name: 'Supplenza', exact: true })).toBeChecked()
  for (const [label, status] of [['Non svolta', 'non_svolta'], ['Svolta', 'svolta'], ['Verifica svolta', 'verifica']] as const) {
    await group.getByRole('radio', { name: label, exact: true }).check()
    await expect(group.locator('input:checked')).toHaveCount(1)
    await expect.poll(() => saved().entries[0].lesson_status).toBe(status)
    expect(saved().entries[0]).toEqual({ ...card.entries[0], lesson_status: status })
    expect(saved().entries[1]).toEqual(card.entries[1])
    expect(saved().notes).toBe(card.notes)
    expect(saved().attachments).toEqual(card.attachments)
  }
  expect(saves()).toBeGreaterThanOrEqual(3)
  await page.goto('/tests/lesson-status.html')
  await expect(group.getByRole('radio', { name: 'Verifica svolta', exact: true })).toBeChecked()
  await expect(page.locator('input[value="API e database"]')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'È stato un lab' }).first()).toBeChecked()
  await page.getByRole('button', { name: 'Anteprima', exact: true }).click()
  await expect(page.getByText('Verifica svolta', { exact: true })).toBeVisible()
  await expect(page.getByText('API e database', { exact: true })).toBeVisible()
  await expect(page.getByText('Portare il computer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click()
  await expect(page).toHaveURL(/\/giorno\/2026-10-02$/)
  await expect(page.getByText('Verifica svolta', { exact: true })).toBeVisible()
  expect(saved().status).toBe('published')
  expect(saved().entries[0]).toEqual({ ...card.entries[0], lesson_status: 'verifica' })
})

test('native radio keyboard navigation, subject association and visible selection', async ({ page }) => {
  const { group } = await setup(page)
  const substitute = group.getByRole('radio', { name: 'Supplenza', exact: true })
  await substitute.focus()
  await expect(substitute).toBeFocused()
  expect(await substitute.evaluate(el => getComputedStyle(el.nextElementSibling!).outlineStyle)).toBe('solid')
  await page.keyboard.press('ArrowRight')
  await expect(group.getByRole('radio', { name: 'Verifica svolta', exact: true })).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(group.getByRole('radio', { name: 'Svolta', exact: true })).toBeChecked()
  await page.keyboard.press('ArrowLeft')
  await expect(group.getByRole('radio', { name: 'Verifica svolta', exact: true })).toBeChecked()
  const selected = group.locator('input:checked')
  expect(await selected.evaluate(el => el.nextElementSibling!.lastElementChild!.querySelector('svg') !== null)).toBe(true)
  await expect(page.getByRole('group', { name: /Stato della lezione · Matematica/ }).getByRole('radio', { name: 'Svolta', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Verifica', exact: true }).first()).toBeVisible()
})

for (const mobile of [false, true]) for (const dark of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} ${dark ? 'dark' : 'light'} full labels, enlarged text and reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const { group } = await setup(page, { mobile, dark, english: true })
    const labels = group.locator('label')
    const first = await labels.nth(0).boundingBox()
    const third = await labels.nth(2).boundingBox()
    expect(mobile ? third!.y > first!.y : third!.y === first!.y).toBe(true)
    await page.evaluate(() => document.documentElement.style.fontSize = '24px')
    await group.getByRole('radio', { name: 'Test taken', exact: true }).check()
    await expect(group.locator('input:checked')).toHaveCount(1)
    for (const label of await labels.all()) {
      const bounds = await label.boundingBox()
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
      expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    }
    const style = await group.locator('input:checked').evaluate(el => {
      const style = getComputedStyle(el.nextElementSibling!)
      return { background: style.backgroundColor, duration: parseFloat(style.transitionDuration) }
    })
    expect(style.duration).toBeLessThanOrEqual(0.00001)
    expect(style.background).toBe(dark ? 'rgb(59, 24, 36)' : 'rgb(247, 230, 235)')
  })
}
