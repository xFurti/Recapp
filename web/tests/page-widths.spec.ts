import { expect, test, type Page } from '@playwright/test'
import { card, cardPage } from './lesson-fixture'
import { setupTimetable } from './timetable-fixture'
import type { Card } from '../src/types'

async function editor(page: Page, width: number, lang: 'it' | 'en' = 'it', dark = false, empty = false) {
  const saved = structuredClone(card)
  saved.entries.push({ ...structuredClone(saved.entries[0]), hours: '5-6' })
  if (empty) { saved.entries = []; saved.attachments = [] }
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
  }, { lang, dark })
  let writes = 0
  await page.route('**/api/**', async route => {
    const request = route.request()
    if (request.url().includes('/attachments/')) return route.fulfill({ status: 404, body: '' })
    if (request.url().includes('/cards/2026-10-02')) {
      if (request.method() === 'PUT') {
        const data = request.postDataJSON() as Pick<Card, 'entries' | 'notes' | 'items'>
        Object.assign(saved, data, { revision: saved.revision + 1 }); writes++
        return route.fulfill({ json: saved })
      }
      return route.fulfill({ json: cardPage(saved) })
    }
    return route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto('/tests/lesson-status.html')
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(empty ? 0 : 3)
  return { saved, writes: () => writes }
}
async function noPageOverflow(page: Page) {
  const bounds = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    outside: Array.from(document.querySelectorAll('main *')).filter(e => !e.closest('[role=region]') && e.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent?.slice(0, 60) })),
  }))
  expect(bounds.scrollWidth, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.width + 1)
}

for (const width of [320, 390, 768, 1024, 1280, 1440]) for (const lang of ['it', 'en'] as const) for (const dark of [false, true]) {
  test(`${width} ${lang} ${dark ? 'dark' : 'light'}: editor order, measure, 200% text and index keyboard`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await editor(page, width, lang, dark)
    const index = page.locator('.editor-index'), body = page.locator('.editor-body')
    const bodyBox = (await body.boundingBox())!, indexBox = (await index.boundingBox())!
    expect(bodyBox.width).toBeLessThanOrEqual(737)
    expect(width >= 1280 ? indexBox.x > bodyBox.x + bodyBox.width : indexBox.y < bodyBox.y).toBe(true)
    await noPageOverflow(page)
    await index.locator('summary').focus(); await page.keyboard.press('Enter')
    await expect(index.locator('details')).not.toHaveAttribute('open', '')
    await page.keyboard.press('Enter')
    await index.locator('a').nth(2).focus(); await page.keyboard.press('Enter')
    const target = page.locator('article h3').nth(2)
    await expect(target).toBeFocused()
    expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(56)
    expect((await target.boundingBox())!.y).toBeLessThan(600)
    await page.keyboard.press('Tab')
    await expect(page.locator('article').nth(2).getByRole('button', { name: lang === 'it' ? 'Rimuovi materia' : 'Remove subject' })).toBeFocused()
    await page.evaluate(() => document.documentElement.style.fontSize = '32px')
    await noPageOverflow(page)
    expect((await body.boundingBox())!.width).toBeLessThanOrEqual(737)
    const actionButtons = await page.evaluate(() => {
      const dockBox = document.querySelector('.tab-bar')?.getBoundingClientRect()
      const dock = dockBox && dockBox.height > 0 ? dockBox : null
      return [...document.querySelectorAll<HTMLButtonElement>('.editor-actions button')].map((button) => {
        const box = button.getBoundingClientRect()
        const label = button.querySelector('.language-text')?.firstChild
        const words = !label || label.nodeType !== Node.TEXT_NODE ? [] : [...label.textContent!.matchAll(/\S+/g)].map((match) => {
          const range = document.createRange()
          range.setStart(label, match.index)
          range.setEnd(label, match.index + match[0].length)
          return { word: match[0], lines: range.getClientRects().length }
        })
        return {
          words,
          clipped: button.scrollHeight > button.clientHeight + 1 || button.scrollWidth > button.clientWidth + 1,
          overlapsDock: !!dock && box.bottom > dock.top + 1,
        }
      })
    })
    expect(actionButtons.length).toBeGreaterThan(0)
    expect(actionButtons.every((button) => !button.clipped && !button.overlapsDock && button.words.every((word) => word.lines === 1))).toBe(true)
    expect(await body.locator('button').evaluateAll(buttons => buttons.filter(button => {
      const r = button.getBoundingClientRect()
      return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)
    }).map(button => button.textContent))).toEqual([])
    await index.locator('a[href="#notes"]').focus(); await page.keyboard.press('Enter')
    await expect(page.locator('#notes')).toBeFocused()
    const notes = (await page.locator('#notes').boundingBox())!, actions = (await page.locator('.editor-actions').boundingBox())!
    expect(notes.y).toBeGreaterThanOrEqual(56)
    expect(notes.y + notes.height).toBeLessThanOrEqual(actions.y + 1)
  })
}

test('index follows add/remove without dropping a draft; preview keeps a reading measure', async ({ page }) => {
  const state = await editor(page, 1440)
  const draft = page.locator('article').first().locator('input[placeholder]').first()
  await draft.fill('Appunto lungo da conservare durante la navigazione e il cambio di disposizione')
  await expect.poll(state.writes).toBe(1)
  const links = page.locator('.editor-index a'), lastTarget = await links.nth(2).getAttribute('href')
  await page.locator('article').nth(1).getByRole('button', { name: 'Rimuovi materia' }).click()
  expect(await links.nth(1).getAttribute('href')).toBe(lastTarget)
  await links.nth(1).click(); await expect(page.locator('article h3').nth(1)).toBeFocused()
  await page.getByRole('button', { name: 'Materia', exact: true }).click()
  await page.getByRole('button', { name: 'Matematica', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(3); await expect(links).toHaveCount(6)
  await page.getByRole('button', { name: 'Anteprima', exact: true }).click()
  expect((await page.locator('.editor-preview').boundingBox())!.width).toBeLessThanOrEqual(736)
  await page.getByRole('button', { name: 'Torna a modificare', exact: true }).click()
  await expect(draft).toHaveValue('Appunto lungo da conservare durante la navigazione e il cambio di disposizione')
  expect(state.saved.entries[0].bullets[0]).toContain('conservare')
})
test('no lessons produce no empty index column', async ({ page }) => {
  await editor(page, 1440, 'en', true, true)
  await expect(page.locator('.editor-index')).toHaveCount(0)
  expect((await page.locator('.editor-body').boundingBox())!.width).toBe(736)
  await expect(page.getByRole('button', { name: 'Subject', exact: true })).toBeVisible()
})
for (const width of [320, 390, 768, 1024, 1440]) test(`timetable ${width}: wide desktop, contained scrolling and keyboard details`, async ({ page }) => {
  await setupTimetable(page, { width, lang: 'en', dark: true })
  await page.getByRole('tab', { name: 'Week', exact: true }).click()
  const table = page.getByRole('table'); await expect(table).toBeVisible(); await noPageOverflow(page)
  if (width === 1440) {
    expect((await table.boundingBox())!.width).toBeGreaterThan(1000)
    expect(await table.locator('..').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  const cell = table.getByRole('button').first()
  await cell.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape'); await expect(cell).toBeFocused()
  await page.evaluate(() => document.documentElement.style.fontSize = '32px'); await noPageOverflow(page)
  await page.getByRole('tab', { name: 'Day', exact: true }).click(); await expect(table).toHaveCount(0); await noPageOverflow(page)
})

for (const path of ['', 'ieri', 'giorni', 'giorno/2026-10-02', 'materia/INI', 'in-arrivo', 'scrivi/2026-10-02', 'classe', 'classe/contributi']) {
  test(`shell keeps header aligned and width by purpose: /${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('**/api/**', route => route.fulfill({ json: { version: 'dev', status: 'idle' } }))
    await page.goto(`/tests/navigation.html?route=${encodeURIComponent(`/c/TEST/${path}`)}`)
    const main = page.locator('main'), header = page.locator('header > div').first()
    const box = (await main.boundingBox())!, top = (await header.boundingBox())!
    expect(box.width).toBe(path.startsWith('classe') || path.startsWith('scrivi') ? 1152 : 768)
    expect(top.x).toBe(box.x); expect(top.width).toBe(box.width)
  })
}
