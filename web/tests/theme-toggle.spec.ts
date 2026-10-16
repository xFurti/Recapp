import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, route = '/', dark = false, mobile = false, language = 'it') {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.addInitScript(({ dark, language }) => {
    if (localStorage.getItem('ieri.theme') === null) localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', language)
  }, { dark, language })
  await page.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/me')
    ? { kind: 'anonymous' } : { version: 'dev', status: 'idle' } }))
  await page.goto(route)
  if (mobile && route === '/tests/navigation.html') await openProfile(page)
  const button = page.getByRole('button', { name: /^(Tema|Theme):/ })
  await expect(button).toBeVisible()
  return button
}

async function openProfile(page: Page) {
  await page.getByRole('button', { name: 'Menu del profilo' }).click()
  await page.getByRole('menu').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished))
  })
}

async function settled(page: Page, dark: boolean) {
  await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /^$/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ieri.theme'))).toBe(dark ? 'dark' : 'light')
  await expect(page.getByRole('button', { name: /^(Tema|Theme):/ })).toHaveAccessibleName(dark ? 'Tema: scuro' : 'Tema: chiaro')
  await expect.poll(() => page.getByRole('button', { name: /^(Tema|Theme):/ }).evaluate(element => {
    const active = element.querySelector(element.getAttribute('data-theme') === 'dark' ? '.theme-icon--moon' : '.theme-icon--sun')!
    const inactive = element.querySelector(element.getAttribute('data-theme') === 'dark' ? '.theme-icon--sun' : '.theme-icon--moon')!
    const scale = (icon: Element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(icon).transform)
      return Math.hypot(matrix.a, matrix.b)
    }
    return { active: Math.round(scale(active) * 1000) / 1000, inactive: scale(inactive) }
  })).toEqual({ active: 1, inactive: 0 })
  await expect(page.locator('html')).not.toHaveClass(/theme-anim/)
}

const routes = [
  ['landing', '/'],
  ['privacy', '/privacy'],
  ['app', '/tests/navigation.html'],
] as const

for (const [name, route] of routes) for (const mobile of [false, true]) for (const dark of [false, true]) {
  test(`${name}, ${mobile ? 'phone' : 'desktop'}, initially ${dark ? 'dark' : 'light'}: both directions, persistence and stable header`, async ({ page }) => {
    const button = await setup(page, route, dark, mobile)
    const flag = page.getByRole('button', { name: 'Passa a inglese' })
    const initialButton = await button.boundingBox()
    const initialFlag = await flag.boundingBox()
    const flagMarkup = await flag.innerHTML()
    expect(initialButton!.width).toBe(32)
    expect(initialButton!.height).toBe(32)
    expect(initialFlag!.width).toBe(28)
    expect(initialFlag!.height).toBe(28)
    expect(await button.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
    await expect(button.locator('svg')).toHaveCount(2)
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(2)
    for (const nextDark of [!dark, dark]) {
      await button.click()
      await settled(page, nextDark)
      expect(await button.boundingBox()).toEqual(initialButton)
      expect(await flag.boundingBox()).toEqual(initialFlag)
      expect(await flag.innerHTML()).toBe(flagMarkup)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await button.click()
    await settled(page, !dark)
    // Reopen with a choice different from the initial seed to verify persistence.
    await page.goto(route)
    if (mobile && name === 'app') await openProfile(page)
    await settled(page, !dark)
  })
}

test('outgoing icon rotates and shrinks for 500ms; incoming icon waits 200ms then rotates and grows', async ({ page }) => {
  const button = await setup(page)
  for (const dark of [true, false]) {
    const frames = await button.evaluate(async element => {
      ;(element as HTMLButtonElement).click()
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const icons = [...element.querySelectorAll<SVGElement>('svg')]
      // The moon's color also fades with the palette; only the transform is the swap.
      const animations = icons.map(icon => icon.getAnimations().find(animation => (animation as CSSTransition).transitionProperty === 'transform')!)
      const timings = animations.map(animation => {
        animation.pause()
        const timing = animation.effect!.getTiming()
        return { duration: timing.duration, delay: timing.delay }
      })
      const samples = [100, 350, 500, 700].map(time => {
        animations.forEach(animation => { animation.currentTime = time })
        return icons.map(icon => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(icon).transform)
          return { scale: Math.hypot(matrix.a, matrix.b), rotation: Math.atan2(matrix.b, matrix.a) }
        })
      })
      animations.forEach(animation => animation.finish())
      return { timings, samples, blending: document.documentElement.classList.contains('theme-anim') }
    })
    const incoming = dark ? 0 : 1
    const outgoing = dark ? 1 : 0
    expect(frames.timings[incoming]).toEqual({ duration: 500, delay: 200 })
    expect(frames.timings[outgoing]).toEqual({ duration: 500, delay: 0 })
    expect(frames.samples[0][incoming].scale).toBe(0)
    expect(frames.samples[0][outgoing].scale).toBeGreaterThan(0)
    expect(frames.samples[0][outgoing].scale).toBeLessThan(1)
    expect(Math.abs(frames.samples[0][outgoing].rotation)).toBeGreaterThan(0.1)
    expect(frames.samples[1][incoming].scale).toBeGreaterThan(0)
    expect(frames.samples[1][incoming].scale).toBeLessThan(1)
    expect(Math.abs(frames.samples[1][incoming].rotation)).toBeGreaterThan(0.1)
    expect(frames.samples[2][outgoing].scale).toBe(0)
    expect(frames.samples[3][incoming].scale).toBeCloseTo(1)
    expect(frames.blending).toBe(true)
    await settled(page, dark)
  }
})

test('Tab, Enter and Space keep focus and the accessible label in Italian and English', async ({ page }) => {
  const button = await setup(page)
  await button.focus()
  expect(await button.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Passa a inglese' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await settled(page, true)
  await expect(button).toBeFocused()
  await page.keyboard.press('Space')
  await settled(page, false)
  await page.getByRole('button', { name: 'Passa a inglese' }).click()
  await expect(button).toHaveAccessibleName('Theme: light')
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAccessibleName('Theme: dark')
  await expect(button).toBeFocused()
})

test('rapid reversals settle on the last choice and hover/focus do not spin the icons', async ({ page }) => {
  const button = await setup(page)
  await button.hover()
  await button.focus()
  expect(await button.evaluate(element => element.querySelectorAll('svg').length === 2 && [...element.querySelectorAll('svg')].every(icon => icon.getAnimations().every(animation => (animation as CSSTransition).transitionProperty !== 'transform')))).toBe(true)
  for (let i = 0; i < 5; i++) {
    await button.evaluate(element => (element as HTMLButtonElement).click())
    await page.waitForTimeout(65)
  }
  await settled(page, true)
  await page.waitForTimeout(250)
  await settled(page, true)
})

for (const dark of [false, true]) test(`reduced motion from ${dark ? 'dark' : 'light'} swaps immediately without rotation or delay`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const button = await setup(page, '/privacy', dark)
  for (const nextDark of [!dark, dark]) {
    await button.click()
    const icons = await button.locator('svg').evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element)
      const matrix = new DOMMatrixReadOnly(style.transform)
      return { animations: element.getAnimations().length, delay: style.transitionDelay, rotation: matrix.b, scale: Math.hypot(matrix.a, matrix.b) }
    }))
    expect(icons[nextDark ? 0 : 1]).toEqual({ animations: 0, delay: '0s', rotation: 0, scale: 1 })
    expect(icons[nextDark ? 1 : 0]).toEqual({ animations: 0, delay: '0s', rotation: 0, scale: 0 })
    await settled(page, nextDark)
  }
})

test('the hidden header toggle follows a change made from the phone profile menu', async ({ page }) => {
  const button = await setup(page, '/tests/navigation.html', false, true)
  await button.click()
  await settled(page, true)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 900 })
  const header = page.getByRole('button', { name: /^(Tema|Theme):/ })
  await expect(header).toHaveAttribute('data-theme', 'dark')
  await expect(header).toHaveAccessibleName('Tema: scuro')
  await header.click()
  await settled(page, false)
})

test('another tab changing the theme updates the button without a reload', async ({ page }) => {
  const button = await setup(page, '/privacy')
  await page.evaluate(() => {
    localStorage.setItem('ieri.theme', 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: 'ieri.theme', newValue: 'dark' }))
  })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(button).toHaveAttribute('data-theme', 'dark')
})
