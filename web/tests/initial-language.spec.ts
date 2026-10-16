import { expect, test, type Page } from '@playwright/test'

type Preferences = { languages?: string[]; language: string }
type InitialState = { heading: string | null; lang: string; toggle: string | null; phase?: string }

const labels = {
  it: { heading: 'Ti sei perso un giorno?', toggle: 'Passa a inglese' },
  en: { heading: 'Missed a day?', toggle: 'Switch to Italian' },
}

async function prepare(page: Page, preferences: Preferences, saved: string | null = null) {
  await page.addInitScript(({ preferences, saved }) => {
    // Seed storage only on the first visit so reloads exercise real persistence.
    if (!sessionStorage.getItem('language-test-started')) {
      sessionStorage.setItem('language-test-started', '1')
      if (saved !== null) localStorage.setItem('ieri.lang', saved)
    }
    const current = JSON.parse(sessionStorage.getItem('language-test-preferences') ?? 'null') ?? preferences
    Object.defineProperty(navigator, 'languages', { get: () => current.languages })
    Object.defineProperty(navigator, 'language', { get: () => current.language })

    // Observe the first React content, before another task or paint could hide a flash.
    const observer = new MutationObserver(() => {
      const heading = document.querySelector('h1')
      if (!heading) return
      const state = {
        heading: heading.textContent,
        lang: document.documentElement.lang,
        toggle: document.querySelector('.lang-btn')?.getAttribute('aria-label') ?? null,
        phase: document.documentElement.dataset.languageTransition,
      }
      ;(window as Window & { initialLanguageState?: typeof state }).initialLanguageState = state
      observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true })
  }, { preferences, saved })
  // These startup tests render the actual landing route; only HTTP is simulated.
  await page.route('**/api/me', route => route.fulfill({ json: { kind: 'guest' } }))
  await page.route('**/api/version', route => route.fulfill({ json: { version: 'dev' } }))
  await page.route('**/api/releases', route => route.fulfill({ json: { version: 'dev', current: null, releases: [] } }))
}

async function expectLanguage(page: Page, lang: 'it' | 'en', firstRender = true) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(labels[lang].heading)
  await expect(page.locator('.lang-btn')).toHaveAccessibleName(labels[lang].toggle)
  await expect(page.locator('html')).toHaveAttribute('lang', lang)
  await expect(page.locator('html')).not.toHaveAttribute('data-language-transition')
  if (firstRender) {
    expect(await page.evaluate(() => (window as Window & { initialLanguageState?: InitialState }).initialLanguageState))
      .toEqual({ ...labels[lang], lang, phase: undefined })
  }
}

const cases: { name: string; preferences: Preferences; saved?: string; expected: 'it' | 'en' }[] = [
  { name: 'Italian first', preferences: { languages: ['it-IT', 'en-US'], language: 'it-IT' }, expected: 'it' },
  { name: 'English first takes priority over Italian', preferences: { languages: ['en-US', 'it-IT'], language: 'en-US' }, expected: 'en' },
  { name: 'skip unsupported preferences', preferences: { languages: ['fr-FR', 'it-CH', 'en'], language: 'fr-FR' }, expected: 'it' },
  { name: 'British English after an unsupported preference', preferences: { languages: ['de-DE', 'en-GB', 'it'], language: 'de-DE' }, expected: 'en' },
  { name: 'base Italian tag', preferences: { languages: ['it'], language: 'it' }, expected: 'it' },
  { name: 'case insensitive regional tag', preferences: { languages: ['IT-ch'], language: 'IT-ch' }, expected: 'it' },
  { name: 'unsupported list falls back to English, not navigator.language', preferences: { languages: ['fr-FR', 'de-DE'], language: 'it-IT' }, expected: 'en' },
  { name: 'missing list uses navigator.language', preferences: { language: 'it-CH' }, expected: 'it' },
  { name: 'empty list uses navigator.language', preferences: { languages: [], language: 'it-IT' }, expected: 'it' },
  { name: 'empty list with British English', preferences: { languages: [], language: 'en-GB' }, expected: 'en' },
  { name: 'unsupported single language falls back to English', preferences: { language: 'fr-FR' }, expected: 'en' },
  { name: 'empty preferences fall back to English', preferences: { languages: [], language: '' }, expected: 'en' },
  { name: 'saved English overrides Italian browser', saved: 'en', preferences: { languages: ['it-IT'], language: 'it-IT' }, expected: 'en' },
  { name: 'saved Italian overrides English browser', saved: 'it', preferences: { languages: ['en-US'], language: 'en-US' }, expected: 'it' },
  { name: 'invalid saved language is ignored', saved: 'fr', preferences: { languages: ['it-IT'], language: 'it-IT' }, expected: 'it' },
  { name: 'saved regional tag is not a valid manual choice', saved: 'en-US', preferences: { languages: ['it-IT'], language: 'it-IT' }, expected: 'it' },
  { name: 'empty saved value is ignored', saved: '', preferences: { languages: ['it-IT'], language: 'it-IT' }, expected: 'it' },
]

for (const { name, preferences, saved, expected } of cases) {
  test(`initial language: ${name}`, async ({ page }) => {
    await prepare(page, preferences, saved)
    await page.goto('/')
    await expectLanguage(page, expected)
    expect(await page.evaluate(() => localStorage.getItem('ieri.lang'))).toBe(saved ?? null)
  })
}

for (const saved of [null, 'invalid']) {
  test(`automatic detection is repeated on reload without replacing ${saved ?? 'absent'} storage`, async ({ page }) => {
    await prepare(page, { languages: ['it-IT', 'en-US'], language: 'it-IT' }, saved)
    await page.goto('/')
    await expectLanguage(page, 'it')
    await page.evaluate(() => sessionStorage.setItem('language-test-preferences', JSON.stringify({ languages: ['en-GB', 'it-IT'], language: 'en-GB' })))
    await page.reload()
    await expectLanguage(page, 'en')
    expect(await page.evaluate(() => localStorage.getItem('ieri.lang'))).toBe(saved)
  })
}

for (const initial of ['it', 'en'] as const) {
  test(`manual choice after automatic ${initial} survives reload and browser preference changes`, async ({ page }) => {
    await prepare(page, { languages: [initial], language: initial })
    await page.goto('/')
    await expectLanguage(page, initial)
    const chosen = initial === 'it' ? 'en' : 'it'
    await page.locator('.lang-btn').click()
    await expectLanguage(page, chosen, false)
    expect(await page.evaluate(() => localStorage.getItem('ieri.lang'))).toBe(chosen)
    await page.reload()
    await expectLanguage(page, chosen)
    await page.evaluate(() => sessionStorage.setItem('language-test-preferences', JSON.stringify({ languages: ['fr-FR'], language: 'fr-FR' })))
    await page.reload()
    await expectLanguage(page, chosen)
    expect(await page.evaluate(() => localStorage.getItem('ieri.lang'))).toBe(chosen)
  })
}

test('automatic Italian is coherent at the first mobile render in dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('ieri.theme', 'dark'))
  await prepare(page, { languages: ['fr-FR', 'it-IT'], language: 'fr-FR' })
  await page.goto('/')
  await expectLanguage(page, 'it')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
