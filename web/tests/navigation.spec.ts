import { expect, test, type Locator, type Page } from '@playwright/test'

async function setup(page: Page, mobile = false, route = '/c/TEST', dark = false) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.route('**/api/**', r => r.fulfill({ json: { version: 'dev', status: 'idle' } }))
  await page.addInitScript(value => localStorage.setItem('ieri.theme', value), dark ? 'dark' : 'light')
  await page.goto(`/tests/navigation.html?route=${encodeURIComponent(route)}`)
  const nav = page.locator(mobile ? '.section-nav-mobile' : '.section-nav-desktop')
  await expect(nav).toBeVisible()
  return nav
}
async function settle(nav: Locator) {
  await nav.locator('.section-nav-indicator').evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished))
  })
}
async function aligned(nav: Locator) {
  await settle(nav)
  const active = await nav.locator('[aria-current="page"]').boundingBox()
  const indicator = await nav.locator('.section-nav-indicator').boundingBox()
  expect(indicator).not.toBeNull()
  expect(active).not.toBeNull()
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(indicator![key]).toBeCloseTo(active![key], 0)
}

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} selection follows routes, history and rapid clicks without layout shifts`, async ({ page }) => {
    const nav = await setup(page, mobile)
    const initial = await nav.getByRole('link', { name: 'Oggi' }).boundingBox()
    await aligned(nav)
    await nav.locator('.section-nav-indicator').evaluate(el => {
      el.addEventListener('transitionrun', event => {
        if ((event as TransitionEvent).propertyName === 'transform') {
          (el as HTMLElement).dataset.observedDuration = String(parseFloat(getComputedStyle(el).transitionDuration) * 1000)
        }
      })
    })
    await nav.getByRole('link', { name: 'Ieri' }).click()
    await expect(nav.locator('.section-nav-indicator')).toHaveAttribute('data-observed-duration', '240')
    await expect(page.getByRole('heading', { name: '/c/TEST/ieri', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Ieri' })).toHaveAttribute('aria-current', 'page')
    await aligned(nav)
    await page.goBack()
    await expect(nav.getByRole('link', { name: 'Oggi' })).toHaveAttribute('aria-current', 'page')
    await aligned(nav)
    await page.goForward()
    await expect(nav.getByRole('link', { name: 'Ieri' })).toHaveAttribute('aria-current', 'page')
    await nav.evaluate(element => {
      const links = element.querySelectorAll<HTMLAnchorElement>('a')
      links[2].click(); links[0].click(); links[3].click()
    })
    await expect(nav.getByRole('link', { name: 'Classe' })).toHaveAttribute('aria-current', 'page')
    expect(await nav.locator('.section-nav-indicator').evaluate(el => el.getAnimations().length)).toBeLessThanOrEqual(1)
    await expect(page.getByRole('heading', { name: '/c/TEST/classe', exact: true })).toBeVisible()
    await aligned(nav)
    const final = await nav.getByRole('link', { name: 'Oggi' }).boundingBox()
    expect(final).toEqual(initial)
  })

  test(`${mobile ? 'mobile' : 'desktop'} initial deep link has no entry animation; unmatched pages clear selection`, async ({ page }) => {
    const nav = await setup(page, mobile, '/c/TEST/in-arrivo')
    await expect(nav.getByRole('link', { name: 'In arrivo' })).toHaveAttribute('aria-current', 'page')
    expect(await nav.locator('.section-nav-indicator').evaluate(el => el.getAnimations().length)).toBe(0)
    await aligned(nav)
    for (const name of ['Editor', 'Materia', 'Archivio']) {
      await page.getByRole('link', { name, exact: true }).click()
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(0)
      await expect(nav.locator('.section-nav-indicator')).toBeHidden()
    }
    await nav.getByRole('link', { name: 'Oggi' }).click()
    await aligned(nav)
  })

  test(`${mobile ? 'mobile' : 'desktop'} hover and keyboard focus do not move selection and icons still animate`, async ({ page }) => {
    const nav = await setup(page, mobile)
    const indicator = await nav.locator('.section-nav-indicator').boundingBox()
    const next = nav.getByRole('link', { name: 'Classe' })
    await next.hover()
    await expect(next.locator('.nav-icon')).toHaveAttribute('data-playing', 'true')
    expect(await nav.locator('.section-nav-indicator').boundingBox()).toEqual(indicator)
    await nav.getByRole('link', { name: 'Oggi' }).focus()
    await page.keyboard.press('Tab')
    const yesterday = nav.getByRole('link', { name: 'Ieri' })
    await expect(yesterday).toBeFocused()
    expect(await yesterday.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
    await expect(nav.getByRole('link', { name: 'Oggi' })).toHaveAttribute('aria-current', 'page')
    await page.keyboard.press('Enter')
    await expect(yesterday).toHaveAttribute('aria-current', 'page')
    await aligned(nav)
  })

  for (const dark of [false, true]) {
    test(`${mobile ? 'mobile' : 'desktop'} ${dark ? 'dark' : 'light'} theme and reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const nav = await setup(page, mobile, '/c/TEST', dark)
      await nav.getByRole('link', { name: 'In arrivo' }).click()
      await expect(nav.getByRole('link', { name: 'In arrivo' })).toHaveAttribute('aria-current', 'page')
      await aligned(nav)
      const indicator = nav.locator('.section-nav-indicator')
      expect(await indicator.evaluate(el => el.getAnimations().length)).toBe(0)
      expect(await indicator.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.00001)
      expect(await indicator.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')
      expect(await indicator.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(dark ? 'rgb(59, 24, 36)' : 'rgb(247, 230, 235)')
      await expect(nav.locator('.nav-icon[data-playing]')).toHaveCount(0)
    })
  }
}

test('resizing across desktop/mobile preserves active selection and translated labels', async ({ page }) => {
  await setup(page, false, '/c/TEST/classe')
  await page.getByRole('button', { name: 'Passa a inglese' }).click()
  const desktop = page.locator('.section-nav-desktop')
  await expect(desktop.getByRole('link', { name: 'Class', exact: true })).toHaveAttribute('aria-current', 'page')
  await aligned(desktop)
  await page.setViewportSize({ width: 390, height: 844 })
  await aligned(page.locator('.section-nav-mobile'))
  await page.setViewportSize({ width: 1280, height: 900 })
  await aligned(desktop)
})
