import { expect, test } from '@playwright/test'
import { labText, presentationCard, presentationSetup } from './lab-presentation-fixture'

for (const view of ['day', 'subject', 'editor']) for (const width of [1280, 390, 320]) for (const english of [false, true]) for (const dark of [false, true]) {
  test(`${view} ${width}px ${english ? 'EN' : 'IT'} ${dark ? 'dark' : 'light'} notes and photos at 100/200%`, async ({ page }) => {
    await presentationSetup(page, { view, width, english, dark })
    const main = page.getByRole('main')
    const gallery = main.getByRole('group', { name: english ? 'Notes photos 3 images' : 'Foto appunti 3 immagini', exact: true })
    await expect(gallery).toBeVisible()
    for (const scale of [1, 2]) {
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%` }, scale)
      const photos = gallery.locator('.attachment-open')
      await expect(photos).toHaveCount(3)
      const sizes = await photos.evaluateAll(elements => elements.map(el => {
        const box = el.getBoundingClientRect()
        return { width: box.width, height: box.height, right: box.right, left: box.left }
      }))
      for (const size of sizes) {
        expect(size.width).toBeGreaterThan(44)
        expect(size.left).toBeGreaterThanOrEqual(0)
        expect(size.right).toBeLessThanOrEqual(width)
        expect(Math.abs(size.width - sizes[0].width)).toBeLessThan(1)
      }
      for (const img of await gallery.locator('img').all()) {
        await img.scrollIntoViewIfNeeded()
        await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
        await expect(img).toHaveCSS('object-fit', 'contain')
      }
      if (view !== 'editor') {
        await expect(main.getByText(labText, { exact: true })).toBeVisible()
        await expect(main.getByText(english ? /Goal: Confrontare le misure/ : /Obiettivo: Confrontare le misure/)).toBeVisible()
      }
      // Inspect the changed blocks; the existing app shell has its own text-zoom layout.
      for (const block of await main.locator('.lab-note, .attachment-gallery').all()) {
        expect(await block.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      }
      await photos.first().focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText(english ? 'Photo 1 of 3' : 'Foto 1 di 3', { exact: true })).toBeVisible()
      await expect(dialog.locator('img')).toHaveAttribute('src', '/api/attachments/7')
      await expect.poll(() => dialog.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      const ratio = await dialog.locator('img').evaluate(el => { const image = el as HTMLImageElement; return image.clientWidth / image.clientHeight - image.naturalWidth / image.naturalHeight })
      expect(Math.abs(ratio)).toBeLessThan(0.01)
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      // Modal contains focus and restores the exact triggering thumbnail.
      await page.keyboard.press('Shift+Tab')
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(photos.first()).toBeFocused()
    }
    // SubjectMenu's pre-existing long-name overflow is outside these content blocks.
    if (width === 320 && view !== 'subject') {
      await page.evaluate(() => { document.documentElement.style.fontSize = '100%' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  })
}

test('pending, failed and retried images have distinct states; original protected URLs are retained', async ({ page }) => {
  await presentationSetup(page)
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/attachments/7', async route => { await gate; await route.fulfill({ status: 403, body: 'Forbidden' }) })
  await page.goto('/tests/lab-presentation.html')
  const gallery = page.getByRole('main').getByRole('group', { name: 'Foto appunti 3 immagini', exact: true })
  const first = gallery.getByRole('button', { name: 'Apri foto 1 di 3', exact: true })
  await expect(first.getByRole('status')).toHaveText('Caricamento…')
  await first.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('status')).toHaveText('Caricamento…')
  release()
  await expect(dialog.getByRole('alert')).toContainText('Immagine non disponibile')
  await expect(first.getByText('Immagine non disponibile')).toBeVisible()
  await page.unroute('**/api/attachments/7')
  await dialog.getByRole('button', { name: 'Riprova', exact: true }).click()
  await expect(dialog.locator('img')).toHaveAttribute('src', '/api/attachments/7')
  await expect.poll(() => dialog.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(first).toBeFocused()
})

test('one photo has a count and opens; clearing a legacy note stays empty', async ({ page }) => {
  const savedCard = structuredClone(presentationCard)
  savedCard.entries = [{ ...savedCard.entries[1], attachment_ids: [9], lab: { ...savedCard.entries[1].lab!, notes: '' } }]
  await presentationSetup(page, { savedCard })
  await expect(page.locator('.lab-note')).toHaveCount(0)
  await expect(page.getByRole('main').getByText('1 immagine', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Apri foto 1 di 1' }).first().click()
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', '/api/attachments/9')
})

test('editor and preview keep attachment associations and removal scoped to the selected image', async ({ page }) => {
  const { saved } = await presentationSetup(page, { view: 'editor' })
  const preview = page.getByRole('button', { name: 'Anteprima', exact: true })
  await preview.click()
  await expect(page.getByRole('main').getByText(labText, { exact: true })).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: 'Apri foto 2 di 3', exact: true }).click()
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', '/api/attachments/8')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Torna a modificare', exact: true }).click()
  await page.getByRole('button', { name: 'Rimuovi foto 1', exact: true }).click()
  await expect.poll(() => saved().attachments.length === 0 && saved().entries[0].attachment_ids.join(',') === '7,8,9').toBe(true)
  // Global attachment removal changes the top-level list only, not subject photos.
  await preview.click()
  await expect(page.getByRole('main').getByRole('button', { name: 'Apri foto 1 di 1' })).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('button', { name: 'Apri foto 1 di 3' })).toBeVisible()
})
