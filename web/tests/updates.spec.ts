import { expect, test, type Page } from '@playwright/test'

const notice = (page: Page) => page.locator('.update-notice')
const draft = (page: Page) => page.getByRole('textbox', { name: 'Draft' })

async function setup(page: Page, { width = 1440, dark = false, english = false, publicPage = false, reduced = true } = {}) {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.addInitScript(({ dark, english }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
  }, { dark, english })
  let status: { version: string; update_id: string | null } = { version: 'updates-e2e', update_id: null }
  let polls = 0
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/version') { polls++; return route.fulfill({ json: status }) }
    if (path === '/api/me') return route.fulfill({ json: { kind: 'anonymous' } })
    if (path === '/api/releases') return route.fulfill({ json: { version: status.version, current: null, releases: [] } })
    return route.fulfill({ json: {} })
  })
  await page.clock.install()
  await page.goto(`/tests/updates.html${publicPage ? '?public' : ''}`)
  await expect.poll(() => polls).toBeGreaterThan(0)
  await expect(page.locator('html')).toHaveAttribute('lang', english ? 'en' : 'it')
  expect(await page.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(dark)
  return {
    async poll(version: string, update_id: string | null = null) {
      status = { version, update_id }
      const previous = polls
      await page.clock.fastForward(16_000)
      await expect.poll(() => polls).toBeGreaterThan(previous)
    },
    async preparing() {
      await this.poll('updates-e2e', 'deploy-one')
      await expect(notice(page)).toHaveAttribute('data-state', 'preparing')
    },
    async ready() {
      await this.poll('next-version')
      await expect(notice(page)).toHaveAttribute('data-state', 'ready')
    },
  }
}

test('preparing expands in place without moving content, stealing focus or reloading', async ({ page }) => {
  const server = await setup(page)
  await draft(page).fill('Appunti da conservare')
  const before = await page.locator('#root header').boundingBox()
  const content = await page.getByRole('heading', { name: 'La tua giornata' }).boundingBox()
  await server.preparing()
  await expect(draft(page)).toBeFocused()
  await expect(notice(page).getByRole('button', { name: 'Aggiorna ora' })).toHaveCount(0)
  const compact = await notice(page).boundingBox()
  await server.ready()
  const expanded = await notice(page).boundingBox()
  expect(expanded!.height).toBeGreaterThan(compact!.height)
  expect(expanded!.y).toBe(compact!.y)
  expect(expanded!.x + expanded!.width).toBeCloseTo(compact!.x + compact!.width, 0)
  expect(await page.locator('#root header').boundingBox()).toEqual(before)
  expect(await page.getByRole('heading', { name: 'La tua giornata' }).boundingBox()).toEqual(content)
  await expect(draft(page)).toBeFocused()
  await expect(draft(page)).toHaveValue('Appunti da conservare')
  await expect(page.locator('.update-notice-host [role="status"]')).toContainText('Una nuova versione è pronta')
  await page.clock.fastForward(180_000)
  await expect(notice(page)).toBeVisible()
})

test('dismissing preparation still announces ready; Later lasts for this version and session', async ({ page }) => {
  const server = await setup(page)
  await server.preparing()
  await notice(page).getByRole('button', { name: 'Chiudi avviso' }).click()
  await expect(notice(page)).toHaveCount(0)
  await server.ready()
  await notice(page).getByRole('button', { name: 'Più tardi' }).click()
  await expect(notice(page)).toHaveCount(0)
  await page.goto('/tests/updates.html')
  await server.poll('next-version')
  await expect(notice(page)).toHaveCount(0)
  await server.poll('another-version')
  await server.poll('another-version')
  await expect(notice(page)).toHaveAttribute('data-state', 'ready')
})

test('failed save keeps the draft open; retry reloads only after the save succeeds', async ({ page }) => {
  const server = await setup(page)
  let saves = 0
  let finish: () => void = () => {}
  await page.route('**/api/test-draft', async route => {
    saves++
    await new Promise<void>(resolve => { finish = resolve })
    await route.fulfill(saves === 1 ? { status: 500, json: { detail: 'Save unavailable' } } : { json: {} })
  })
  let navigations = 0
  page.on('request', request => { if (request.isNavigationRequest()) navigations++ })
  await draft(page).fill('La bozza deve restare qui')
  await server.preparing()
  await server.ready()
  await notice(page).getByRole('button', { name: 'Aggiorna ora' }).click()
  await expect.poll(() => saves).toBe(1)
  for (const button of await notice(page).getByRole('button').all()) await expect(button).toBeDisabled()
  expect(navigations).toBe(0)
  finish()
  await expect(notice(page).getByText(/Non sono riuscito a salvare/)).toBeVisible()
  await expect(draft(page)).toHaveValue('La bozza deve restare qui')
  expect(navigations).toBe(0)
  await notice(page).getByRole('button', { name: 'Riprova' }).click()
  await expect.poll(() => saves).toBe(2)
  expect(navigations).toBe(0)
  finish()
  await expect.poll(() => navigations).toBe(1)
})

for (const width of [320, 390, 1440]) for (const dark of [false, true]) for (const english of [false, true]) {
  test(`fits below the header: ${width}px, ${dark ? 'dark' : 'light'}, ${english ? 'en' : 'it'}`, async ({ page }) => {
    const server = await setup(page, { width, dark, english })
    await server.preparing()
    await server.ready()
    const box = await notice(page).boundingBox()
    const header = await page.locator('#root header').boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 11)
    expect(box!.x).toBeGreaterThanOrEqual(11)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width - 11)
    for (const button of await notice(page).getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await notice(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => document.documentElement.style.fontSize = '24px')
    await expect(notice(page)).toBeVisible()
    expect(await notice(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.setViewportSize({ width, height: 480 })
    await expect.poll(async () => { const b = await notice(page).boundingBox(); return b!.y + b!.height }).toBeLessThanOrEqual(469)
  })
}

test('public header is followed across scrolling and navigation; reduced motion disables effects', async ({ page }) => {
  const server = await setup(page, { publicPage: true, width: 390 })
  await server.preparing()
  await server.ready()
  await page.getByRole('link', { name: 'FAQ e creatori' }).click()
  await expect(page).toHaveURL(/\/faq$/)
  await expect(page.getByRole('heading', { name: 'FAQ e creatori', exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.clock.runFor(32)
  await expect.poll(async () => {
    const header = await page.locator('#root header').boundingBox()
    const box = await notice(page).boundingBox()
    return box && header ? box.y - header.y - header.height : 0
  }).toBeGreaterThanOrEqual(11)
  await page.evaluate(() => window.scrollTo(0, 700))
  await page.clock.runFor(32)
  await expect.poll(async () => (await notice(page).boundingBox())!.y).toBe(12)
  expect(await notice(page).evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
})

test('normal motion has finite logo and border effects and keeps the same card during the transition', async ({ page }) => {
  const server = await setup(page, { reduced: false })
  await server.preparing()
  expect(await notice(page).evaluate(el => el.getAnimations({ subtree: true }).every(a => Number(a.effect?.getTiming().iterations) <= 3))).toBe(true)
  await notice(page).evaluate(el => el.setAttribute('data-test-identity', 'same-card'))
  await server.ready()
  await expect(notice(page)).toHaveAttribute('data-test-identity', 'same-card')
  expect(await notice(page).evaluate(el => el.getAnimations({ subtree: true }).every(a => Number(a.effect?.getTiming().iterations) <= 3))).toBe(true)
})
