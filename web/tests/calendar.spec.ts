import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { card, info, items, today } from './calendar-fixture'

async function setup(page: Page, { mobile = false, dark = false, english = false, demo = false, path = '/in-arrivo' } = {}) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ dark, english }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    localStorage.setItem('ieri.simulatedNow', '2026-10-12T10:00')
    localStorage.setItem('recapp.tour.demo', '1')
    localStorage.setItem('calendar-private-pin', 'PRIVATE_PIN_987654')
  }, { dark, english })
  await page.route('**/api/**', async route => {
    const url = route.request().url()
    if (url.includes('/upcoming')) await route.fulfill({ json: items })
    else if (url.includes('/today')) await route.fulfill({ json: today })
    else if (url.includes('/subjects/')) await route.fulfill({ json: { results: [{ ...card.entries[0], id: 1, day: card.day, author: card.author, items }], next_cursor: null } })
    else await route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto(`/tests/calendar.html?path=${encodeURIComponent(path)}${demo ? '&demo' : ''}`)
  const triggers = page.getByRole('button', { name: english ? 'Add to calendar' : 'Aggiungi al calendario', exact: true })
  await expect(triggers).toHaveCount(4)
  return triggers
}

for (const mobile of [false, true]) for (const dark of [false, true]) for (const english of [false, true]) {
  test(`Upcoming ${mobile ? 'phone' : 'desktop'} ${dark ? 'dark' : 'light'} ${english ? 'English' : 'Italian'}`, async ({ page }) => {
    const demo = dark !== english
    const triggers = await setup(page, { mobile, dark, english, demo })
    const types = english ? ['Homework', 'Test', 'Event', 'Lab'] : ['Compito', 'Verifica', 'Evento', 'Lab']
    for (let i = 0; i < 4; i++) {
      await triggers.nth(i).click()
      const menu = page.getByRole('menu', { name: english ? 'Add to calendar' : 'Aggiungi al calendario' })
      await expect(menu).toBeVisible()
      const google = menu.getByRole('menuitem', { name: 'Google Calendar' })
      await expect(google).toBeFocused()
      const url = new URL((await google.getAttribute('href'))!)
      expect(url.searchParams.get('text')).toBe([types[i], i ? english ? 'History' : 'Storia' : '', items[i].title].filter(Boolean).join(' · '))
      expect(url.searchParams.get('dates')).toBe('20261025/20261026')
      expect(url.searchParams.get('details')).toContain(info.name)
      expect(url.searchParams.get('details')).toContain(`/c/${demo ? 'DEMO' : 'TEST'}/in-arrivo`)
      expect(url.searchParams.get('details')).not.toContain('PRIVATE_')
      expect(await google.getAttribute('target')).toBe('_blank')
      const menuBounds = (await menu.boundingBox())!
      expect(menuBounds.x).toBeGreaterThanOrEqual(0)
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width)
      if (mobile) {
        const navBounds = (await page.getByRole('navigation').last().boundingBox())!
        expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(navBounds.y)
      }
      expect(await menu.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(dark ? 'rgb(30, 27, 33)' : 'rgb(255, 255, 255)')
      const downloadPromise = page.waitForEvent('download')
      await menu.getByRole('menuitem', { name: english ? 'Apple Calendar' : 'Calendario Apple' }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('recapp-20261025.ics')
      const ics = await readFile((await download.path())!, 'utf8')
      expect(ics).toContain('DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026')
      expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${url.searchParams.get('text')!.replaceAll('\\', '\\\\').replaceAll(',', '\\,').replaceAll(';', '\\;')}`)
      expect(ics).not.toMatch(/PRIVATE_NICK|PRIVATE_PIN|PRIVATE_NOTES|2330|ATTENDEE|ORGANIZER/)
      await expect(menu).toHaveCount(0)
      await expect(triggers.nth(i)).toBeFocused()
    }
    await expect(page.getByRole('button', { name: english ? 'Mark as done' : 'Segna come fatto' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: english ? 'Open link' : 'Apri link' }).first()).toBeVisible()
    await expect(page.locator('a[href="/api/attachments/7"]')).toBeVisible()
  })
}

test('keyboard opening, arrows, Home/End, Escape, Tab and outside dismissal', async ({ page }) => {
  const triggers = await setup(page)
  const trigger = triggers.first()
  await trigger.focus()
  await page.keyboard.press('ArrowUp')
  const apple = page.getByRole('menuitem', { name: 'Calendario Apple' })
  const google = page.getByRole('menuitem', { name: 'Google Calendar' })
  await expect(apple).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(google).toBeFocused()
  await page.keyboard.press('End')
  await expect(apple).toBeFocused()
  await page.keyboard.press('Home')
  await expect(google).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await expect(google).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Segna come fatto' }).first()).toBeFocused()
  await trigger.click()
  await page.getByRole('heading', { name: 'In arrivo', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('Google opens a new tab from the keyboard and uses the current app language', async ({ page }) => {
  await setup(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Passa a inglese' }).click()
  const trigger = page.getByRole('button', { name: 'Add to calendar', exact: true }).nth(1)
  await trigger.focus()
  await page.keyboard.press('Enter')
  const google = page.getByRole('menuitem', { name: 'Google Calendar' })
  await expect(google).toBeFocused()
  await page.context().route('https://calendar.google.com/**', route => route.fulfill({ body: 'Google Calendar destination' }))
  const popupPromise = page.waitForEvent('popup')
  await page.keyboard.press('Enter')
  const popup = await popupPromise
  await popup.waitForLoadState()
  expect(new URL(popup.url()).searchParams.get('text')).toBe('Test · History · capitolo 12')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await popup.close()
})

test('small phone with enlarged text keeps the button and menu on screen above the tabs', async ({ page }) => {
  const triggers = await setup(page, { mobile: true })
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px' })
  await triggers.last().click()
  const menu = page.getByRole('menu', { name: 'Aggiungi al calendario' })
  await expect(menu).toBeVisible()
  const bounds = (await menu.boundingBox())!
  const tabs = (await page.locator('.tab-bar').boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(8)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(312)
  expect(bounds.y).toBeGreaterThanOrEqual(8)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(tabs.y)
  expect(await triggers.last().evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await expect(page.getByRole('menuitem', { name: 'Google Calendar' })).toBeFocused()
})

for (const path of ['', '/giorno/2026-10-12', '/materia/STO']) {
  test(`calendar action is available on ${path || 'Today'} and does not edit the item`, async ({ page }) => {
    const writes: string[] = []
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()) })
    const triggers = await setup(page, { path })
    await triggers.first().click()
    const google = page.getByRole('menuitem', { name: 'Google Calendar' })
    await expect(google).toHaveAttribute('href', /dates=20261025%2F20261026/)
    if (path) expect(await triggers.first().innerText()).toBe('')
    await page.keyboard.press('Escape')
    expect(writes).toEqual([])
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

for (const timezoneId of ['Europe/Rome', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  test(`export keeps the stored date in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId })
    const page = await context.newPage()
    const triggers = await setup(page)
    await triggers.nth(1).click()
    const url = new URL((await page.getByRole('menuitem', { name: 'Google Calendar' }).getAttribute('href'))!)
    expect(url.searchParams.get('dates')).toBe('20261025/20261026')
    await context.close()
  })
}
