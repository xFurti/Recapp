import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, { width = 1280, dark = false, language = 'it', reduced = false } = {}) {
  await page.setViewportSize({ width, height: width < 600 ? 720 : 900 })
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ dark, language }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', language)
  }, { dark, language })
  await page.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/me')
    ? { kind: 'anonymous' } : { version: 'dev', status: 'idle' } }))
  await page.goto('/')
  const week = page.getByTestId('missed-week')
  await expect(week).toBeVisible()
  return week
}

const running = (week: Locator) => week.evaluate(el => el.getAnimations({ subtree: true }).length)
const finished = (week: Locator) => week.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))

const overlaps = (a: DOMRect | null, b: DOMRect | null) =>
  !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('the missing day returns within about a second and the controls work meanwhile', async ({ page }) => {
  const week = await open(page)
  await expect(week).toHaveAttribute('aria-hidden', 'true')
  await expect(week.locator('.missed-week-tile:not(.missed-week-tile--back)')).toHaveCount(5)
  const timings = await week.evaluate(el => el.getAnimations({ subtree: true }).map(a => {
    const t = a.effect!.getComputedTiming()
    return Number(t.delay) + Number(t.activeDuration)
  }))
  expect(timings.length).toBe(4)
  expect(Math.max(...timings)).toBeLessThanOrEqual(1300)
  // The class code field takes input while the entrance is still running.
  await page.getByLabel('Codice classe').fill('4BI')
  expect(await running(week)).toBeGreaterThan(0)
  await finished(week)
  await expect(page.getByRole('button', { name: 'Prova la demo' })).toBeEnabled()
})

test('typing, language and theme changes never restart the entrance', async ({ page }) => {
  const week = await open(page)
  await finished(week)
  await week.evaluate(el => { (el as HTMLElement & { mark?: boolean }).mark = true })
  await page.getByLabel('Codice classe').pressSequentially('4BI-K7Q2')
  expect(await running(week)).toBe(0)
  await page.getByRole('button', { name: /^(Tema|Theme):/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await running(week)).toBe(0)
  await page.getByRole('button', { name: 'Passa a inglese' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Missed a day?')
  await expect(week.locator('.missed-week-tile--front b')).toHaveText('W')
  expect(await running(week)).toBe(0)
  expect(await week.evaluate(el => (el as HTMLElement & { mark?: boolean }).mark)).toBe(true)
})

test('reduced motion shows the final composition and still stickers', async ({ page }) => {
  const week = await open(page, { reduced: true })
  expect(await running(week)).toBe(0)
  const found = week.locator('.missed-week-found')
  expect(await found.evaluate(el => [getComputedStyle(el).opacity, getComputedStyle(el).transform])).toEqual(['1', 'none'])
  const sticker = page.locator('.sticker').first()
  const before = await sticker.boundingBox()
  await sticker.hover()
  await page.mouse.down()
  await page.mouse.move(before!.x + 40, before!.y + 40)
  expect(await sticker.evaluate(el => [getComputedStyle(el).transform, el.hasAttribute('data-pressed')])).toEqual(['none', false])
  await page.mouse.up()
})

test('stickers are decorative, peel on hover and spring back after a tug', async ({ page }) => {
  await open(page)
  const stickers = page.locator('.sticker')
  await expect(stickers).toHaveCount(3)
  for (const sticker of await stickers.all()) {
    await expect(sticker).toHaveAttribute('aria-hidden', 'true')
    expect(await sticker.evaluate(el => el.querySelector('[tabindex], button, a'))).toBeNull()
  }
  const sticker = stickers.first()
  const peel = () => sticker.evaluate(el => getComputedStyle(el).getPropertyValue('--peel'))
  const rest = await sticker.boundingBox()
  await sticker.hover()
  await expect.poll(peel).toBe('14px')
  await page.mouse.down()
  await page.mouse.move(rest!.x + rest!.width / 2 + 60, rest!.y + rest!.height / 2 + 60, { steps: 6 })
  const offset = await sticker.evaluate(el => [el.style.getPropertyValue('--drag-x'), el.style.getPropertyValue('--drag-y')])
  expect(offset).toEqual(['8px', '8px'])
  await page.mouse.up()
  await page.mouse.move(0, 0)
  await expect.poll(async () => JSON.stringify(await sticker.boundingBox())).toBe(JSON.stringify(rest))
  await expect.poll(peel).toBe('0px')
})

test('a tap on a sticker reacts without capturing the page', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 720 } })
  const page = await context.newPage()
  await open(page, { width: 390 })
  const sticker = page.locator('.sticker').first()
  expect(await sticker.evaluate(el => getComputedStyle(el).touchAction)).toBe('manipulation')
  await sticker.tap()
  await expect(sticker).not.toHaveAttribute('data-pressed')
  expect(await sticker.evaluate(el => el.style.getPropertyValue('--drag-x') || '0px')).toBe('0px')
  await context.close()
})

for (const width of [320, 390, 1024, 1280]) for (const language of ['it', 'en']) for (const dark of [false, true]) for (const zoom of ['100%', '200%']) {
  test(`layout at ${width}px, ${language}, ${dark ? 'dark' : 'light'}, text ${zoom}`, async ({ page }) => {
    const week = await open(page, { width, language, dark })
    await page.evaluate(zoom => { document.documentElement.style.fontSize = zoom }, zoom)
    await finished(week)
    // At 320px with 200% text the header and the logo already overflow on main; this only checks the new art.
    const box = await week.evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
    const main = await page.locator('main').evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
    expect(box.x).toBeGreaterThanOrEqual(main.x)
    expect(box.x + box.width).toBeLessThanOrEqual(Math.min(main.x + main.width, width))
    for (const other of [page.getByRole('heading', { level: 1 }), page.locator('main section p').first(), page.getByLabel(/Codice classe|Class code/), page.locator('main ul')]) {
      const rect = await other.evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
      expect(overlaps(box, rect)).toBe(false)
    }
    // Beside the title from 1024px, below the subtitle otherwise.
    const title = await page.getByRole('heading', { level: 1 }).boundingBox()
    if (width >= 1024 && zoom === '100%') expect(box.x).toBeGreaterThan(title!.x + title!.width - 1)
    if (width < 1024) expect(box.y).toBeGreaterThan(title!.y + title!.height)
  })
}
