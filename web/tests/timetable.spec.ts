import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { setupTimetable } from './timetable-fixture'

async function clockCovered(table: Locator) {
  const coverage = await table.evaluate(element => {
    const scroller = element.parentElement!
    const left = scroller.getBoundingClientRect().left
    const headers = Array.from(element.querySelectorAll<HTMLTableCellElement>('th:first-child'))
    const rect = element.getBoundingClientRect()
    const right = headers[0].getBoundingClientRect().right
    const leaks: { x: number; y: number; text: string | null }[] = []
    // Include the inter-row gaps and both edges, where the old grid leaked lessons.
    for (let y = rect.top + 1; y < rect.bottom - 1; y += 2) {
      for (const x of [left + 1, right - 1]) {
        const cell = document.elementFromPoint(x, y)?.closest('td')
        if (cell) leaks.push({ x, y, text: cell.textContent })
      }
    }
    return {
      leaks,
      headers: headers.map(header => ({ x: header.getBoundingClientRect().left, width: header.getBoundingClientRect().width, background: getComputedStyle(header).backgroundColor })),
      left,
      paper: getComputedStyle(document.body).backgroundColor,
    }
  })
  expect(coverage.leaks).toEqual([])
  expect(coverage.headers).toHaveLength(8)
  for (const header of coverage.headers) {
    expect(header.x).toBeCloseTo(coverage.left, 0)
    expect(header.width).toBeCloseTo(coverage.headers[0].width, 0)
    expect(header.background).toBe(coverage.paper)
  }
}

async function wholeDays(table: Locator) {
  await expect.poll(() => table.evaluate(element => {
    const scroller = element.parentElement!
    const hour = element.querySelector('th')!.getBoundingClientRect()
    const edge = scroller.getBoundingClientRect().right
    const days = Array.from(element.querySelectorAll('thead th')).slice(1).map(day => day.getBoundingClientRect())
    const visible = days.filter(day => day.right > hour.right + 1 && day.left < edge - 1)
    return visible.length > 0 && Math.abs(visible[0].left - hour.right) < 1 && Math.abs(visible[visible.length - 1].right - edge) < 1
  })).toBe(true)
}

async function showGrid(page: Page, table: Locator) {
  await table.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 100))
  await expect(table).toBeVisible()
  const bounds = (await table.locator('..').boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
}

async function touchScroll(page: Page, context: BrowserContext, table: Locator, width: number) {
  // Hold a native touch gesture mid-scroll: snap is not applied until release.
  const scroller = table.locator('..')
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const y = (await table.boundingBox())!.y + 90
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width - 30, y }] })
  for (let step = 1; step <= 5; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width - 30 - step * 18, y }] })
    await page.waitForTimeout(30)
  }
  expect(await scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(10)
  await clockCovered(table)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wholeDays(table)
  await clockCovered(table)
  await session.detach()
}

for (const width of [320, 390]) for (const dark of [false, true]) for (const lang of ['it', 'en'] as const) {
  test(`${width}px ${dark ? 'dark' : 'light'} ${lang}: opaque periods, whole-day snapping and correct editing`, async ({ page, context }) => {
    await setupTimetable(page, { width, dark, lang })
    const weekLabel = lang === 'it' ? 'Settimana' : 'Week'
    const hint = page.getByText(lang === 'it' ? 'Scorri per gli altri giorni' : 'Scroll for the other days', { exact: true })
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('tab', { name: lang === 'it' ? 'Giorno' : 'Day', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: weekLabel, exact: true }).click()
    const table = page.getByRole('table')
    const scroller = table.locator('..')
    await showGrid(page, table)
    await wholeDays(table)
    await clockCovered(table)
    await expect(hint).toBeVisible()

    await touchScroll(page, context, table, width)

    const dayWidth = await table.locator('thead th').nth(1).evaluate(element => element.getBoundingClientRect().width)
    for (const offset of [dayWidth * 1.6, 10000, 0]) {
      await scroller.evaluate((element, left) => element.scrollTo({ left, behavior: 'instant' }), offset)
      await wholeDays(table)
      await clockCovered(table)
      await expect(hint).toBeVisible()
    }

    // The same grid in ClassPage's editor must open and save the selected Friday period.
    await page.getByRole('button', { name: lang === 'it' ? 'Modifica orario' : 'Edit timetable', exact: true }).click()
    await showGrid(page, table)
    await touchScroll(page, context, table, width)
    await scroller.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }))
    await wholeDays(table)
    await clockCovered(table)
    const friday = lang === 'it' ? 'Venerdì, 7ª ora' : 'Friday, hour 7'
    await table.getByRole('button', { name: new RegExp(`^${friday}`) }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAccessibleName(friday)
    await expect(dialog.getByRole('combobox')).toHaveValue('MAT')
    await expect(dialog.getByRole('textbox')).toHaveValue('A263')
    await dialog.getByRole('textbox').fill('A999')
    await dialog.getByRole('button', { name: lang === 'it' ? 'Salva' : 'Save', exact: true }).click()
    await expect(table.getByRole('button', { name: new RegExp(`^${friday}`) })).toContainText('A999')
    await page.getByRole('button', { name: lang === 'it' ? 'Salva orario' : 'Save timetable', exact: true }).click()
    await expect(table.getByRole('button', { name: new RegExp(`^${friday}`) })).toContainText('A999')
    await page.getByRole('tab', { name: lang === 'it' ? 'Giorno' : 'Day', exact: true }).click()
    await expect(table).toHaveCount(0)
    await expect(hint).toBeHidden()
    await page.getByRole('button', { name: lang === 'it' ? 'Venerdì' : 'Friday', exact: true }).click()
    await expect(page.getByText('A999', { exact: false })).toBeVisible()
  })
}

test('desktop has no horizontal scroll or hint; resizing keeps complete columns', async ({ page }) => {
  await setupTimetable(page, { width: 1280, lang: 'en' })
  const table = page.getByRole('table')
  const scroller = table.locator('..')
  await expect(table).toBeVisible()
  await expect(page.getByText('Scroll for the other days', { exact: true })).toBeHidden()
  expect(await scroller.evaluate(element => element.scrollWidth - element.clientWidth)).toBe(0)
  await wholeDays(table)
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await wholeDays(table)
    if (width < 768) {
      await expect(page.getByText('Scroll for the other days', { exact: true })).toBeVisible()
      await scroller.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }))
      await wholeDays(table)
    } else {
      await expect(page.getByText('Scroll for the other days', { exact: true })).toBeHidden()
      expect(await scroller.evaluate(element => element.scrollWidth - element.clientWidth)).toBe(0)
    }
  }
})
