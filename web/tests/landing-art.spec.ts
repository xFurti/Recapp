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
  const day = page.getByTestId('title-day')
  await expect(day).toBeVisible()
  return day
}

// Only the entrance counts: the language switch fades `.language-text` on its own.
const running = (day: Locator) => day.evaluate(el =>
  el.getAnimations({ subtree: true }).filter(a => (a as CSSAnimation).animationName?.startsWith('title-day-')).length)
const finished = (day: Locator) => day.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))

const overlaps = (a: DOMRect | null, b: DOMRect | null) =>
  !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('the missed day lands in the title within about a second and the controls work meanwhile', async ({ page }) => {
  const day = await open(page)
  // The word stays part of the heading for screen readers; only the motion is decorative.
  await expect(page.getByRole('heading', { level: 1, name: 'Ti sei perso un giorno?' })).toBeVisible()
  await expect(day.locator('.title-day-slip')).toHaveText('giorno')
  const timings = await day.evaluate(el => el.getAnimations({ subtree: true }).filter(a => (a as CSSAnimation).animationName?.startsWith('title-day-')).map(a => {
    const t = a.effect!.getComputedTiming()
    return Number(t.delay) + Number(t.activeDuration)
  }))
  expect(timings.length).toBe(3)
  expect(Math.max(...timings)).toBeLessThanOrEqual(1300)
  // The class code field takes input while the entrance is still running.
  await page.getByLabel('Codice classe').fill('4BI')
  expect(await running(day)).toBeGreaterThan(0)
  await finished(day)
  expect(await day.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('0')
  await expect(page.getByRole('button', { name: 'Prova la demo' })).toBeEnabled()
})

test('typing, language and theme changes never restart the entrance', async ({ page }) => {
  const day = await open(page)
  await finished(day)
  await day.evaluate(el => { (el as HTMLElement & { mark?: boolean }).mark = true })
  await page.getByLabel('Codice classe').pressSequentially('4BI-K7Q2')
  expect(await running(day)).toBe(0)
  await page.getByRole('button', { name: /^(Tema|Theme):/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await running(day)).toBe(0)
  await page.getByRole('button', { name: 'Passa a inglese' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Missed a day?')
  await expect(day.locator('.title-day-slip')).toHaveText('day')
  expect(await running(day)).toBe(0)
  expect(await day.evaluate(el => (el as HTMLElement & { mark?: boolean }).mark)).toBe(true)
})

test('reduced motion shows the final title and still stickers', async ({ page }) => {
  const day = await open(page, { reduced: true })
  expect(await running(day)).toBe(0)
  expect(await day.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('0')
  expect(await day.locator('.title-day-fly').evaluate(el => getComputedStyle(el).opacity)).toBe('1')
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
    const day = await open(page, { width, language, dark })
    await page.evaluate(zoom => { document.documentElement.style.fontSize = zoom }, zoom)
    await finished(day)
    // At 320px with 200% text the header and the logo already overflow on main; this only checks the title.
    const slip = await day.locator('.title-day-slip').evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
    const title = await page.getByRole('heading', { level: 1 }).evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
    expect(slip.x).toBeGreaterThanOrEqual(title.x - 2)
    expect(slip.x + slip.width).toBeLessThanOrEqual(Math.min(title.x + title.width, width) + 2)
    // The question mark stays on the slip's line.
    const mark = await day.locator('xpath=following-sibling::span[1]').evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
    expect(Math.abs(mark.y + mark.height / 2 - (slip.y + slip.height / 2))).toBeLessThan(slip.height / 2)
    for (const other of [page.locator('main section p').first(), page.getByLabel(/Codice classe|Class code/), page.locator('main ul')]) {
      const rect = await other.evaluate(el => el.getBoundingClientRect().toJSON() as DOMRect)
      expect(overlaps(slip, rect)).toBe(false)
    }
  })
}
