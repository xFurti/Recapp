import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { members, setupMembers } from './members-fixture'

const capture = process.env.MEMBERS_CAPTURE
if (capture) for (const width of [320, 390, 1280]) for (const dark of [false, true]) for (const lang of ['it', 'en'] as const) {
  test(`capture ${width}px ${dark ? 'dark' : 'light'} ${lang}`, async ({ page }) => {
    await setupMembers(page, { width, dark, lang })
    await page.goto('/c/TEST/classe')
    await expect(page.getByText(lang === 'it' ? '25 partecipanti' : '25 members', { exact: true })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const folder = `../docs/screenshots/issue-141/${capture}`
    await mkdir(folder, { recursive: true })
    await page.screenshot({ animations: 'disabled', path: `${folder}/${width}-${dark ? 'dark' : 'light'}-${lang}.png`, fullPage: true })
  })
}

if (capture) for (const width of [390, 1280]) {
  test(`capture everyday nicknames ${width}px`, async ({ page }) => {
    await setupMembers(page, { width, naturalNames: true })
    await page.goto('/c/TEST/classe')
    await expect(page.getByText('25 partecipanti', { exact: true })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.locator('main ul').last().evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 130))
    await page.screenshot({ animations: 'disabled', path: `../docs/screenshots/issue-141/${capture}/${width}-usage-it.png` })
  })
}

if (!capture) {
  for (const width of [320, 390, 1280]) for (const dark of [false, true]) for (const lang of ['it', 'en'] as const) for (const scale of [1, 2]) {
    test(`25 participants: ${width}px ${dark ? 'dark' : 'light'} ${lang} ${scale * 100}% text`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await setupMembers(page, { width, dark, lang })
      await page.goto('/c/TEST/classe')
      const list = page.getByRole('list', { name: lang === 'it' ? 'Partecipanti' : 'Members', exact: true })
      const rows = list.getByRole('listitem')
      await expect(rows).toHaveCount(25)
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%` }, scale)
      const toolbar = await page.locator('.member-toolbar').boundingBox()
      expect(toolbar!.x).toBeGreaterThanOrEqual(0)
      expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(width)
      const issues = await rows.evaluateAll(elements => elements.flatMap(element => {
        const row = element.getBoundingClientRect()
        const action = element.querySelector('button')!.getBoundingClientRect()
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const boxes: { text: string; rect: DOMRect }[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim() || node.parentElement?.closest('svg, [aria-hidden]')) continue
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const rect of range.getClientRects()) {
            if (rect.width && rect.height) boxes.push({ text: node.textContent, rect })
          }
        }
        const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        return [
          ...boxes.filter(({ rect }) => rect.left < row.left - 1 || rect.right > row.right + 1 || rect.top < row.top - 1 || rect.bottom > row.bottom + 1).map(b => `clipped: ${b.text}`),
          ...boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b => overlaps(a.rect, b.rect)).map(b => `overlap: ${a.text}/${b.text}`)),
          ...boxes.filter(b => overlaps(b.rect, action)).map(b => `action overlap: ${b.text}`),
          ...(row.left < 0 || row.right > innerWidth ? ['list outside viewport'] : []),
          ...(action.width < 44 || action.height < 44 ? ['small touch target'] : []),
        ]
      }))
      expect(issues).toEqual([])
      const positions = await rows.evaluateAll(elements => elements.map(el => ({
        name: el.querySelector('.member-name')!.getBoundingClientRect().left,
        nameY: el.querySelector('.member-name')!.getBoundingClientRect().top - el.getBoundingClientRect().top,
        action: el.querySelector('button')!.getBoundingClientRect().left,
        actionY: el.querySelector('button')!.getBoundingClientRect().top - el.getBoundingClientRect().top,
      })))
      for (const position of positions) expect(position).toEqual(positions[0])
      // An ordinary participant must not reserve space for absent roles or statuses.
      if (scale === 1) {
        expect((await rows.nth(3).boundingBox())!.height).toBeLessThanOrEqual(76)
        expect((await list.boundingBox())!.height).toBeLessThan(2100)
      }
      await expect(rows.first().locator('.member-role')).toHaveText('Admin')
      await expect(rows.first().locator('.member-status')).toContainText(lang === 'it' ? 'Verbalista oggi' : 'Note-taker today')
      await expect(rows.nth(2).locator('.member-status')).toHaveText(lang === 'it' ? 'Non attivato' : 'Not activated')
      await expect(rows.nth(2).locator('.member-stats')).toHaveCount(0)
      await expect(rows.nth(3).locator('.member-stats')).toContainText(lang === 'it' ? '0 giornate' : '0 days')
      await expect(list.locator('[data-me]')).toHaveCount(1)
      // The last participant must still be reachable after scrolling a long class.
      await rows.last().getByRole('button').focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('menu')).toBeVisible()
      await page.getByRole('menuitem').first().waitFor({ state: 'visible' })
      await expect(page.getByRole('menuitem').first()).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(rows.last().getByRole('button')).toBeFocused()
    })
  }

  for (const viewer of ['member', 'admin', 'owner'] as const) for (const demo of [false, true]) {
    test(`actions remain scoped: ${viewer}, ${demo ? 'demo' : 'official'}`, async ({ page }) => {
      const calls = await setupMembers(page, { viewer, demo })
      await page.goto('/c/TEST/classe')
      const list = page.getByRole('list', { name: 'Partecipanti', exact: true })
      await expect(list.getByRole('listitem')).toHaveCount(25)
      if (viewer === 'member') {
        await expect(list.getByRole('button')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Aggiungi partecipante' })).toHaveCount(0)
        return
      }
      for (const index of [0, 1, 4]) {
        const opener = list.getByRole('listitem').nth(index).getByRole('button')
        await expect(opener).toHaveAccessibleName(`Gestisci ${members[index].nick}`)
        await opener.focus()
        await page.keyboard.press('Enter')
        const menu = page.getByRole('menu')
        await expect(menu).toHaveAccessibleName(`Gestisci ${members[index].nick}`)
        await expect(menu.getByRole('menuitem', { name: /^Nuovo invito/ })).toBeFocused()
        await expect(menu.getByRole('menuitem', { name: 'Rimuovi', exact: true })).toHaveCount(!demo && (viewer === 'owner' || index !== 0) && (viewer === 'owner' || members[index].role !== 'admin') ? 1 : 0)
        await expect(menu.getByRole('menuitem', { name: /^(Rendi admin|Togli admin)$/ })).toHaveCount(viewer === 'owner' && !demo ? 1 : 0)
        if (demo) await expect(menu).toContainText('demo')
        await page.keyboard.press('Escape')
        await expect(opener).toBeFocused()
      }
      expect(calls).toEqual([])
    })
  }

  test('keyboard reset and removal keep confirmation, focus and the correct participant', async ({ page }) => {
    const calls = await setupMembers(page, { viewer: 'admin' })
    await page.goto('/c/TEST/classe')
    const opener = page.getByRole('button', { name: `Gestisci ${members[1].nick}`, exact: true })
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAccessibleName(`Nuovo invito per ${members[1].nick}?`)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(calls).toEqual([])
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('menuitem', { name: 'Rimuovi', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveAccessibleName(`Rimuovere ${members[1].nick} dalla classe?`)
    await dialog.getByRole('button', { name: 'Rimuovi', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(calls).toEqual([{ method: 'DELETE', path: '/classes/TEST/members/2', body: null }])
  })
}

if (capture === 'after') {
  for (const width of [320, 390]) {
    test(`capture ${width}px 200% reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await setupMembers(page, { width, lang: width === 320 ? 'it' : 'en', dark: width === 390 })
      await page.goto('/c/TEST/classe')
      const list = page.locator('.member-list')
      await expect(list.getByRole('listitem')).toHaveCount(25)
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
      await list.evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 140))
      await page.screenshot({ animations: 'disabled', path: `../docs/screenshots/issue-141/after/${width}-text-200.png` })
    })
  }
  test('capture keyboard menu', async ({ page }) => {
    await setupMembers(page, { lang: 'en', dark: true })
    await page.goto('/c/TEST/classe')
    const opener = page.locator('.member-list button').first()
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem').first()).toBeFocused()
    await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/issue-141/after/390-keyboard-menu.png' })
  })
}
