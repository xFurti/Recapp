import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, mobile = false, dark = false, saved = 'it') {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.addInitScript(({ dark, saved }) => { localStorage.setItem('ieri.theme', dark ? 'dark' : 'light'); localStorage.setItem('ieri.lang', saved) }, { dark, saved })
  await page.route('**/api/**', route => route.fulfill({ json: { version: 'dev', status: 'idle' } }))
  await page.goto('/tests/language.html')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}
const toggle = (page: Page) => page.locator('.lang-btn:visible').first()
const settle = (page: Page, lang: string) => expect.poll(async () => page.evaluate(() => ({ lang: document.documentElement.lang, phase: document.documentElement.dataset.languageTransition ?? '' }))).toEqual({ lang, phase: '' })

for (const mobile of [false, true]) {
  for (const dark of [false, true]) {
    test(`${mobile ? 'phone' : 'desktop'} ${dark ? 'dark' : 'light'} text fade, preserved controls and open modal`, async ({ page }) => {
      await setup(page, mobile, dark)
      await expect(page.locator('html')).not.toHaveAttribute('data-language-transition')
      const draft = page.getByRole('textbox', { name: 'Draft', exact: true })
      await draft.fill('Il mio testo non cambia. 📝')
      await draft.focus()
      await draft.evaluate((input: HTMLTextAreaElement) => input.setSelectionRange(3, 8))
      const samples = await toggle(page).evaluate(async button => {
        const heading = document.querySelector('h1 .language-text')!
        const authored = document.querySelector('[data-testid=authored]')!
        const icon = document.querySelector('.section-nav-link svg')!
        const nav = document.querySelector('.section-nav-indicator')!
        const before = heading.textContent
        ;(button as HTMLButtonElement).click()
        const old = heading.textContent
        const values: number[] = []
        await new Promise<void>(resolve => {
          const start = performance.now()
          function frame() {
            values.push(Number(getComputedStyle(heading).opacity))
            if (performance.now() - start < 240) requestAnimationFrame(frame)
            else resolve()
          }
          requestAnimationFrame(frame)
        })
        return { before, old, after: heading.textContent, values, authoredOpacity: getComputedStyle(authored).opacity, iconOpacity: getComputedStyle(icon).opacity, navigationAnimations: nav.getAnimations().length, sameHeading: heading === document.querySelector('h1 .language-text') }
      })
      expect(samples.old).toBe(samples.before)
      expect(samples.after).not.toBe(samples.before)
      expect(Math.min(...samples.values)).toBeLessThan(0.4)
      expect(samples.values.at(-1)).toBe(1)
      expect(samples.authoredOpacity).toBe('1'); expect(samples.iconOpacity).toBe('1')
      expect(samples.navigationAnimations).toBe(0); expect(samples.sameHeading).toBe(true)
      await settle(page, 'en')
      await expect(draft).toBeFocused(); await expect(draft).toHaveValue('Il mio testo non cambia. 📝')
      expect(await draft.evaluate((input: HTMLTextAreaElement) => [input.selectionStart, input.selectionEnd])).toEqual([3, 8])
      await page.getByRole('button', { name: 'Change PIN', exact: true }).click()
      const modal = page.getByRole('dialog')
      await modal.getByRole('textbox', { name: 'PIN draft' }).fill('987654')
      await modal.getByRole('textbox', { name: 'PIN draft' }).focus()
      await modal.locator('.lang-btn').evaluate((button: HTMLButtonElement) => button.click())
      await settle(page, 'it')
      await expect(page.getByRole('dialog', { name: 'Cambia PIN' })).toBeVisible()
      await expect(modal.getByRole('textbox', { name: 'PIN draft' })).toHaveValue('987654')
      await expect(modal.getByRole('textbox', { name: 'PIN draft' })).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}

test('rapid requests finish in the last language without stale commits', async ({ page }) => {
  await setup(page)
  await toggle(page).evaluate(async button => {
    for (let n = 0; n < 5; n++) { (button as HTMLButtonElement).click(); await new Promise(resolve => setTimeout(resolve, 30)) }
  })
  await settle(page, 'en')
  await expect(toggle(page)).toHaveAccessibleName('Switch to Italian')
  expect(await page.evaluate(() => localStorage.getItem('ieri.lang'))).toBe('en')
  await page.waitForTimeout(250)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('initial saved language and reduced motion update immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await setup(page, false, false, 'en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const result = await toggle(page).evaluate((button: HTMLButtonElement) => {
    button.click()
    return { lang: document.documentElement.lang, phase: document.documentElement.dataset.languageTransition, animations: document.querySelector('h1 span')!.getAnimations().length }
  })
  expect(result).toEqual({ lang: 'it', phase: undefined, animations: 0 })
})

test('scroll and selection of authored text survive a language switch', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => {
    const node = document.querySelector('[data-testid=authored]')!.firstChild!
    const range = document.createRange(); range.setStart(node, 3); range.setEnd(node, 12)
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range)
    window.scrollTo(0, 260)
  })
  const before = await page.evaluate(() => ({ scroll: scrollY, text: getSelection()!.toString() }))
  await page.locator('.lang-btn').first().evaluate((button: HTMLButtonElement) => button.click())
  await settle(page, 'en')
  expect(await page.evaluate(() => ({ scroll: scrollY, text: getSelection()!.toString() }))).toEqual(before)
  await expect(page.getByTestId('mixed')).toContainText('Ada')
  expect(await page.getByTestId('mixed').locator('strong').evaluate(el => el.closest('.language-text'))).toBeNull()
})

test('record Italian-English transition for issue 36', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ recordVideo: { dir: testInfo.outputPath('video'), size: { width: 960, height: 720 } }, viewport: { width: 960, height: 720 } })
  const page = await context.newPage()
  await setup(page)
  await page.setViewportSize({ width: 960, height: 720 })
  await page.waitForTimeout(500)
  await toggle(page).click(); await settle(page, 'en'); await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Change PIN', exact: true }).click()
  await page.getByRole('dialog').locator('.lang-btn').click(); await settle(page, 'it'); await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.setViewportSize({ width: 390, height: 720 })
  await page.getByRole('button', { name: 'Cambia PIN', exact: true }).click()
  await page.waitForTimeout(500)
  await page.getByRole('dialog').locator('.lang-btn').click(); await settle(page, 'en'); await page.waitForTimeout(700)
  await context.close()
  const video = await page.video()!.path()
  await testInfo.attach('language-transition', { path: video, contentType: 'video/webm' })
})
