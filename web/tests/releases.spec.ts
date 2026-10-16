import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { Release, Releases } from '../src/lib/releases'
import { info } from './lesson-fixture'

const release = JSON.parse(readFileSync('../release-notes/2026-10-13-novita.json', 'utf8')) as Release
const oldRelease: Release = { ...release, id: '2026.10.01.1', published_at: '2026-10-01T12:00:00Z', title: { it: 'Un aggiornamento passato', en: 'A past update' }, entries: [{ ...release.entries[0], category: 'fix' }] }
const popup = (page: Page) => page.getByRole('dialog', { name: 'Ecco le novità di Recapp' })

async function setup(page: Page, { demo = false, fresh = false, editor = false, mobile = false, dark = false, english = false, current = release.id, version = 'notes-e2e', seen = [] as string[], fail = false, failPreference = false } = {}) {
  const stored = [...seen]
  const acknowledgements: string[] = []
  await page.setViewportSize(mobile ? { width: 320, height: 740 } : { width: 1280, height: 900 })
  await page.addInitScript(({ dark, english, demo, fresh }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    if (demo && !fresh) localStorage.setItem('recapp.tour.demo', '1')
  }, { dark, english, demo, fresh })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/releases') {
      if (fail) return route.fulfill({ status: 503, json: { detail: 'unavailable' } })
      return route.fulfill({ json: { version, current, releases: [release, oldRelease] } satisfies Releases })
    }
    if (path === '/api/release-preference') {
      if (failPreference) return route.fulfill({ status: 503, json: {} })
      if (route.request().method() === 'POST') {
        const id = route.request().postDataJSON().release_id as string
        acknowledgements.push(id)
        stored.push(id)
        return route.fulfill({ json: { ok: true, stored: true } })
      }
      return route.fulfill({ json: { seen: stored } })
    }
    if (path === '/api/me') return route.fulfill({ json: { kind: 'anonymous' } })
    if (path === '/api/classes/TEST') return route.fulfill({ status: 401, json: { detail: 'Accedi' } })
    if (path === '/api/classes/TEST/public') return route.fulfill({ json: { ...info, members: [{ ...info.viewer.member, needs_setup: false }] } })
    return route.fulfill({ json: { version, update_id: null } })
  })
  const query = new URLSearchParams({ ...(demo ? { demo: '1' } : {}), ...(fresh ? { fresh: '1' } : {}), ...(editor ? { editor: '1' } : {}) })
  return { url: `/tests/releases.html?${query}`, acknowledgements, stored }
}

test('public home link, direct URL, history, categories, images and protected links', async ({ page }) => {
  await setup(page)
  const withImage = { ...release, entries: [{ ...release.entries[0], image: { src: '/favicon.png', alt: { it: 'Immagine del rilascio', en: 'Release image' } }, link: { href: '/c/TEST/in-arrivo', label: { it: 'Apri la funzione', en: 'Open feature' }, requires_login: true } }] }
  await page.route('**/api/releases', route => route.fulfill({ json: { version: 'notes-e2e', current: release.id, releases: [withImage, oldRelease] } }))
  await page.goto('/')
  const links = page.getByRole('navigation', { name: 'Informazioni' }).getByRole('link')
  await expect(links.nth(0)).toHaveText('Privacy')
  await expect(links.nth(1)).toHaveText('Novità')
  await links.nth(1).click()
  await expect(page).toHaveURL(/\/novita$/)
  await expect(page.getByRole('heading', { name: 'Novità', exact: true })).toBeVisible()
  await expect(page.locator('article').first()).toHaveAttribute('id', `release-${release.id}`)
  await expect(page.locator('article')).toHaveCount(2)
  await expect(page.locator('article').first().getByRole('heading', { name: 'Correzioni' })).toHaveCount(0)
  await expect(page.locator('article').last().getByRole('heading', { name: 'Correzioni' })).toBeVisible()
  await expect(page.getByAltText('Immagine del rilascio')).toBeVisible()
  await expect(page.getByText('Accesso richiesto')).toBeVisible()
  await page.getByRole('link', { name: 'Apri la funzione' }).click()
  await expect(page).toHaveURL(/\/c\/TEST\/entra$/)
})

for (const mobile of [false, true]) for (const dark of [false, true]) {
  test(`page and popup ${mobile ? 'phone' : 'desktop'} ${dark ? 'dark' : 'light'} English and reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const { url } = await setup(page, { mobile, dark, english: true, demo: true })
    await page.goto(url)
    const dialog = page.getByRole('dialog', { name: "Here's what's new in Recapp" })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('li')).toHaveCount(3)
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await page.evaluate(() => document.documentElement.style.fontSize = '24px')
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await dialog.getByRole('link', { name: 'Read all updates' }).click()
    await expect(page.getByRole('heading', { name: "What's new", exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: "What's new, all in one place" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('official account acknowledges on Escape, restores focus, keeps focus contained and skips refresh', async ({ page }) => {
  const { url, acknowledgements } = await setup(page)
  await page.goto(url)
  await page.getByRole('link', { name: 'Today', exact: true }).focus()
  await expect(popup(page)).toBeVisible()
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(popup(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Today', exact: true })).toBeFocused()
  await expect.poll(() => acknowledgements).toEqual([release.id])
  await page.goto(url)
  await page.waitForTimeout(1800)
  await expect(popup(page)).toHaveCount(0)
})

test('official server preference suppresses the popup with no browser copy', async ({ page }) => {
  const { url } = await setup(page, { seen: [release.id] })
  await page.goto(url)
  await page.waitForTimeout(1800)
  await expect(popup(page)).toHaveCount(0)
})

test('demo dismissal survives a new demo session and another nickname', async ({ page }) => {
  const { url, acknowledgements } = await setup(page, { demo: true })
  await page.goto(url)
  await popup(page).getByRole('button', { name: 'Ho capito' }).click()
  expect(acknowledgements).toEqual([])
  await page.goto(url)
  await page.waitForTimeout(1800)
  await expect(popup(page)).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('recapp.releases.demo')!))).toContain(release.id)
})

test('first visit gives the real tutorial precedence and establishes a baseline', async ({ page }) => {
  const { url, acknowledgements } = await setup(page, { fresh: true })
  await page.goto(url)
  await expect(page.locator('.tour-card')).toBeVisible()
  await expect(popup(page)).toHaveCount(0)
  await expect.poll(() => acknowledgements).toContain(release.id)
  await page.locator('.tour-card').getByRole('button', { name: 'Salta' }).click()
  await page.waitForTimeout(1800)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('editor is never interrupted; announcement waits for a safe screen', async ({ page }) => {
  const { url } = await setup(page, { editor: true })
  await page.goto(url)
  await page.getByRole('textbox', { name: 'Draft' }).fill('Testo ancora in lavorazione')
  await page.waitForTimeout(1800)
  await expect(popup(page)).toHaveCount(0)
  await page.getByRole('link', { name: 'Today', exact: true }).click()
  await expect(popup(page)).toBeVisible()
  await popup(page).getByRole('button', { name: 'Ho capito' }).click()
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('Testo ancora in lavorazione')
})

test('other dialog, unsaved changes and saves in flight defer the announcement', async ({ page }) => {
  const { url } = await setup(page)
  await page.goto(url)
  await page.getByRole('button', { name: 'Toggle unsaved work' }).click()
  await page.getByRole('button', { name: 'Open another dialog' }).click()
  await page.waitForTimeout(1800)
  await expect(popup(page)).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Another dialog' }).getByRole('button', { name: 'Chiudi' }).click()
  await page.waitForTimeout(1200)
  await expect(popup(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Save something' }).click()
  await page.getByRole('button', { name: 'Toggle unsaved work' }).click()
  await page.waitForTimeout(1400)
  await expect(popup(page)).toHaveCount(0)
  await expect(popup(page)).toBeVisible()
})

for (const scenario of ['old build', 'no notes', 'notes failure', 'preference failure'] as const) {
  test(`${scenario} does not announce or block the app`, async ({ page }) => {
    test.skip(scenario === 'old build' && !process.env.APP_VERSION, 'Version matching is verified with playwright.releases.config.ts')
    const { url } = await setup(page, { version: scenario === 'old build' ? 'next-version' : 'notes-e2e', current: scenario === 'no notes' ? '' : release.id, fail: scenario === 'notes failure', failPreference: scenario === 'preference failure' })
    await page.goto(url)
    await page.getByRole('textbox', { name: 'Draft' }).fill('Posso continuare')
    await page.getByRole('link', { name: 'Today', exact: true }).focus()
    await page.waitForTimeout(1800)
    await expect(popup(page)).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('Posso continuare')
  })
}

test('page failure offers retry and preserves public navigation', async ({ page }) => {
  await setup(page, { fail: true })
  await page.goto('/novita')
  await expect(page.getByRole('heading', { name: 'Novità' })).toBeVisible()
  await expect(page.getByText(/Le novità non sono disponibili/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Riprova' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Recapp' })).toBeVisible()
})

test('skipped releases show only the latest; opening all notes remembers it', async ({ page }) => {
  const { url, acknowledgements } = await setup(page, { seen: ['2026.09.01.1'] })
  await page.goto(url)
  await expect(popup(page)).toBeVisible()
  await expect(popup(page).getByText('Un aggiornamento passato')).toHaveCount(0)
  await popup(page).getByRole('link', { name: 'Leggi tutte le novità' }).click()
  await expect(page.locator('article')).toHaveCount(2)
  await expect.poll(() => acknowledgements).toEqual([release.id])
})

test('a rollback withdraws an open announcement and its history entry', async ({ page }) => {
  test.skip(!process.env.APP_VERSION, 'Production-version check uses the dedicated config')
  const { url } = await setup(page, { seen: [oldRelease.id] })
  await page.clock.install()
  await page.goto(url)
  await expect(popup(page)).toBeVisible()
  await page.route('**/api/releases', route => route.fulfill({ json: { version: 'rollback-version', current: oldRelease.id, releases: [oldRelease] } }))
  await page.clock.fastForward(61_000)
  await expect(popup(page)).toHaveCount(0)
  await page.goto('/novita')
  await expect(page.locator('article')).toHaveCount(1)
  await expect(page.locator('article').first()).toHaveAttribute('id', `release-${oldRelease.id}`)
})

test('first demo visit establishes the same baseline before the tutorial', async ({ page }) => {
  const { url } = await setup(page, { demo: true, fresh: true })
  await page.goto(url)
  await expect(page.locator('.tour-card')).toBeVisible()
  await page.locator('.tour-card').getByRole('button', { name: 'Salta' }).click()
  await page.waitForTimeout(1800)
  await expect(popup(page)).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('recapp.releases.demo')!))).toContain(release.id)
})
