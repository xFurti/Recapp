import { expect, test, type Page } from '@playwright/test'
import { COVER_MS, REVEAL_MS } from '../src/lib/page-curtain'

const TOTAL_MS = COVER_MS + REVEAL_MS

type Log = { shown: number[]; hidden: number[]; frozen: string[]; started: number }

async function setup(page: Page, { mobile = false, dark = false, route = '/c/TEST', upcomingDelay = 0 } = {}) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.route('**/api/**', async r => {
    const path = new URL(r.request().url()).pathname
    if (path === '/api/upcoming') {
      await new Promise(resolve => setTimeout(resolve, upcomingDelay))
      return r.fulfill({ json: { title: 'Verifica di storia' } })
    }
    if (path === '/api/members') return r.fulfill({ status: 500, json: { detail: 'Server non raggiungibile' } })
    return r.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.addInitScript(value => localStorage.setItem('ieri.theme', value), dark ? 'dark' : 'light')
  await page.goto(`/tests/page-transition.html?route=${encodeURIComponent(route)}`)
  await expect(page.locator('main h1')).toBeVisible()
  // Records every time the curtain opens or closes and every frozen page it covers.
  await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>('.page-curtain')!
    const log: Log = { shown: [], hidden: [], frozen: [], started: performance.now() }
    ;(window as unknown as { curtain: Log }).curtain = log
    new MutationObserver(() => (layer.hidden ? log.hidden : log.shown).push(performance.now())).observe(layer, { attributeFilter: ['hidden'] })
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) log.frozen.push((node as HTMLElement).querySelector('h1')?.textContent ?? '')
    }).observe(layer.querySelector('.page-curtain-old')!, { childList: true })
  })
  return mobile ? page.locator('.section-nav-mobile') : page.locator('.section-nav-desktop')
}

const log = (page: Page) => page.evaluate(() => (window as unknown as { curtain: Log }).curtain)
const settled = (page: Page) => expect(page.locator('.page-curtain')).toBeHidden()

for (const mobile of [false, true]) {
  const name = mobile ? 'mobile' : 'desktop'

  test(`${name}: covers the old page, mounts the new one at once and reveals it in one transition time`, async ({ page }) => {
    const nav = await setup(page, { mobile, upcomingDelay: 150 })
    const during = await nav.getByRole('link', { name: 'In arrivo' }).evaluate(async link => {
      const layer = document.querySelector<HTMLElement>('.page-curtain')!
      ;(link as HTMLElement).click()
      // The router renders in a transition: wait for React to commit the new page.
      for (let i = 0; i < 30 && layer.hidden; i++) await new Promise(requestAnimationFrame)
      const main = document.querySelector('main')!
      const frozen = document.querySelector('.page-curtain-frozen')
      return {
        url: location.pathname,
        mains: document.querySelectorAll('main').length,
        covered: !document.querySelector<HTMLElement>('.page-curtain')!.hidden,
        inert: main.inert,
        liveHeading: main.querySelector('h1')?.textContent,
        frozenHeading: frozen?.querySelector('h1')?.textContent,
        frozenReachable: frozen?.querySelectorAll('[id], [tabindex], [data-tour]').length,
        frozenInert: (frozen as HTMLElement | null)?.inert,
        headerInert: document.querySelector('header')!.inert || !!document.querySelector('header')!.closest('[inert]'),
        navInert: !!document.querySelector('nav')!.closest('[inert]'),
        ariaHidden: document.querySelector('.page-curtain')!.getAttribute('aria-hidden'),
      }
    })
    expect(during).toEqual({
      url: '/c/TEST/in-arrivo', mains: 1, covered: true, inert: true, liveHeading: 'In arrivo', frozenHeading: 'Oggi',
      frozenReachable: 0, frozenInert: true, headerInert: false, navInert: false, ariaHidden: 'true',
    })
    await settled(page)
    const { shown, hidden, frozen } = await log(page)
    // Data loading started with the navigation, while the old page was still being covered.
    await expect(page.locator('[data-loaded]')).toBeVisible()
    const requested = await page.evaluate(() => performance.getEntriesByType('resource').find(entry => entry.name.endsWith('/api/upcoming'))!.startTime)
    expect(requested - shown[0]).toBeLessThan(50)
    expect(hidden[0] - requested).toBeGreaterThan(TOTAL_MS * 0.6)
    expect(shown).toHaveLength(1)
    expect(frozen).toEqual(['Oggi'])
    expect(hidden[0] - shown[0]).toBeGreaterThan(TOTAL_MS - 40)
    expect(hidden[0] - shown[0]).toBeLessThan(TOTAL_MS + 100)
    await expect(page.locator('main')).not.toHaveAttribute('inert')
    await expect(page.locator('main h1')).toBeFocused()
    await expect(nav.getByRole('link', { name: 'In arrivo' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-loaded]')).toHaveText('Verifica di storia')
  })

  test(`${name}: the edge travels along the navigation, forwards and backwards`, async ({ page }) => {
    const nav = await setup(page, { mobile })
    // The covered band along the travel axis, at the first frame where the cover is part way.
    const sweep = (label: string) => nav.getByRole('link', { name: label }).evaluate(async (link, isMobile) => {
      const panel = document.querySelector<HTMLElement>('.page-curtain-panel')!
      const old = document.querySelector<HTMLElement>('.page-curtain-old')!
      ;(link as HTMLElement).click()
      while (old.hidden) await new Promise(requestAnimationFrame)
      for (;;) {
        await new Promise(requestAnimationFrame)
        const points = panel.style.clipPath.match(/-?[\d.]+% -?[\d.]+%/g)!.map(p => p.split(' ').map(parseFloat))
        const along = points.map(([x, y]) => (isMobile ? x : y))
        const band = { min: Math.min(...along), max: Math.max(...along) }
        if (old.hidden || (band.max > 0 && band.min < 100)) return band
      }
    }, mobile)
    const forward = await sweep('Classe')
    await settled(page)
    const backward = await sweep('Ieri')
    // Forward covers from the start (top / left), backward from the end (bottom / right).
    expect(forward.min).toBeLessThanOrEqual(0)
    expect(forward.max).toBeGreaterThan(0)
    expect(forward.max).toBeLessThan(100)
    expect(backward.max).toBeGreaterThanOrEqual(100)
    expect(backward.min).toBeGreaterThan(0)
    await settled(page)
  })

  test(`${name}: rapid clicks retarget one curtain and land on the last section`, async ({ page }) => {
    const nav = await setup(page, { mobile })
    const lastClick = await nav.evaluate(async element => {
      const links = element.querySelectorAll<HTMLAnchorElement>('a')
      for (const index of [1, 2, 3, 1, 0, 2]) {
        links[index].click()
        await new Promise(resolve => setTimeout(resolve, 70))
      }
      return performance.now() - 70
    })
    await settled(page)
    const { shown, hidden, frozen } = await log(page)
    // One curtain: a click during a cover only changes the destination, one during a reveal turns
    // the edge back. Nothing is queued, so it opens one transition after the last click at most.
    expect(shown.length).toBe(hidden.length)
    expect(frozen.length).toBeLessThan(6)
    expect(frozen[0]).toBe('Oggi')
    expect(hidden.at(-1)! - lastClick).toBeLessThan(TOTAL_MS + 80)
    await expect(page).toHaveURL(/\/c\/TEST\/in-arrivo$/)
    await expect(page.locator('main h1')).toHaveText('In arrivo')
    await expect(page.locator('main h1')).toHaveCount(1)
    await expect(nav.getByRole('link', { name: 'In arrivo' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  })
}

test('Back and Forward keep URL, page and selection together', async ({ page }) => {
  const nav = await setup(page)
  await nav.getByRole('link', { name: 'Ieri' }).click()
  await settled(page)
  await nav.getByRole('link', { name: 'Classe' }).click()
  await settled(page)
  for (const [move, url, heading] of [['back', '/c/TEST/ieri', 'Ieri'], ['back', '/c/TEST', 'Oggi'], ['forward', '/c/TEST/ieri', 'Ieri']] as const) {
    await (move === 'back' ? page.goBack() : page.goForward())
    await settled(page)
    expect(new URL(page.url()).pathname).toBe(url)
    await expect(page.locator('main h1')).toHaveText(heading)
    await expect(nav.getByRole('link', { name: heading })).toHaveAttribute('aria-current', 'page')
  }
  // Rapid Back/Back/Forward from the history still lands on one consistent page.
  await page.evaluate(() => { history.back(); history.back(); history.forward() })
  await settled(page)
  await page.waitForTimeout(100)
  await settled(page)
  const heading = await page.locator('main h1').textContent()
  const expected = { '/c/TEST': 'Oggi', '/c/TEST/ieri': 'Ieri', '/c/TEST/classe': 'Classe' }[new URL(page.url()).pathname]
  expect(heading).toBe(expected)
  await expect(nav.getByRole('link', { name: heading! })).toHaveAttribute('aria-current', 'page')
  expect((await log(page)).shown.length).toBeGreaterThan(0)
})

test('first load, filters, language and theme never play the page transition', async ({ page }) => {
  await setup(page, { route: '/c/TEST/ieri' })
  await page.getByRole('link', { name: 'Filtra matematica' }).click()
  await expect(page.locator('[data-filter]')).toHaveText('MAT')
  await page.getByRole('button', { name: /Passa a/ }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: /theme|tema/i }).click()
  await page.waitForTimeout(600)
  const { shown, frozen } = await log(page)
  expect(shown).toEqual([])
  expect(frozen).toEqual([])
})

test('slow data shows the new page loading instead of keeping it covered', async ({ page }) => {
  const nav = await setup(page, { upcomingDelay: 3000 })
  await nav.getByRole('link', { name: 'In arrivo' }).click()
  await settled(page)
  await expect(page.locator('main [role="status"]')).toBeVisible()
  await expect(page.locator('[data-loaded]')).toHaveText('Verifica di storia', { timeout: 5000 })
})

test('a failing page is revealed with its normal error message', async ({ page }) => {
  const nav = await setup(page)
  await nav.getByRole('link', { name: 'Classe' }).click()
  await settled(page)
  await expect(page.locator('main [role="alert"]')).toContainText('Server non raggiungibile')
  await expect(page.locator('main')).not.toHaveAttribute('inert')
})

test('a navigation refused by unsaved changes does not start the transition', async ({ page }) => {
  await setup(page, { route: '/c/TEST/scrivi/2026-10-03' })
  await page.getByRole('button', { name: 'Menu del profilo' }).click()
  await page.getByRole('menuitem', { name: 'Rivedi il tutorial' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(500)
  expect(new URL(page.url()).pathname).toBe('/c/TEST/scrivi/2026-10-03')
  await expect(page.locator('main h1')).toHaveText('Scrivi')
  expect((await log(page)).shown).toEqual([])
})

test('keyboard: the new page takes focus once it is revealed', async ({ page }) => {
  const nav = await setup(page)
  await nav.getByRole('link', { name: 'Ieri' }).focus()
  await page.keyboard.press('Enter')
  // Enter's default link activation can commit after keyboard.press resolves.
  // Observe the transition only after navigation has actually started.
  await expect(page.locator('.page-curtain')).toBeVisible()
  const during = await page.evaluate(() => ({
    covered: !document.querySelector<HTMLElement>('.page-curtain')!.hidden,
    focusInMain: !!document.activeElement?.closest('main'),
  }))
  expect(during).toEqual({ covered: true, focusInMain: false })
  await settled(page)
  await expect(page.locator('main h1')).toBeFocused()
  await expect(page.locator('main h1')).toHaveText('Ieri')
  // The next Tab continues inside the new page.
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true)
})

test('reduced motion changes page without the curtain', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const nav = await setup(page)
  await nav.getByRole('link', { name: 'Classe' }).click()
  await expect(page.locator('main h1')).toHaveText('Classe')
  await expect(page.locator('main h1')).toBeFocused()
  await page.waitForTimeout(300)
  expect((await log(page)).shown).toEqual([])
})

for (const dark of [false, true]) {
  test(`${dark ? 'dark' : 'light'} theme: the curtain uses the theme colors`, async ({ page }) => {
    const nav = await setup(page, { dark })
    const colors = await nav.getByRole('link', { name: 'Ieri' }).evaluate(async link => {
      ;(link as HTMLElement).click()
      await new Promise(requestAnimationFrame)
      const color = (selector: string) => getComputedStyle(document.querySelector(selector)!).backgroundColor
      return { panel: color('.page-curtain-panel'), edge: color('.page-curtain-edge'), old: color('.page-curtain-old'), body: color('body') }
    })
    expect(colors).toEqual(dark
      ? { panel: 'rgb(59, 24, 36)', edge: 'rgb(200, 59, 98)', old: 'rgb(20, 18, 22)', body: 'rgb(20, 18, 22)' }
      : { panel: 'rgb(247, 230, 235)', edge: 'rgb(160, 40, 72)', old: 'rgb(246, 244, 241)', body: 'rgb(246, 244, 241)' })
    await settled(page)
  })
}

test('focus moved elsewhere during the transition stays there', async ({ page }) => {
  const nav = await setup(page)
  await nav.getByRole('link', { name: 'Ieri' }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  const moved = await page.evaluate(() => document.activeElement?.textContent)
  await settled(page)
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(moved)
  await expect(page.locator('main h1')).not.toBeFocused()
})
