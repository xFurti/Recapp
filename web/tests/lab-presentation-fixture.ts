import type { Page } from '@playwright/test'
import type { Card } from '../src/types'
import { card, cardPage, info } from './lesson-fixture'

export const longLink = `https://phet.colorado.edu/it/simulations/circuit-construction-kit-dc?worksheet=${'misure-'.repeat(28)}&version=2#scheda`
export const labText = 'La tabella delle misure è nel quaderno.\nControllare la portata prima di usare il multimetro.\n\nMisure ricontrollate: tensione, corrente e resistenza.'
export const presentationCard: Card = {
  ...structuredClone(card), notes: '', status: 'draft',
  entries: [
    { ...card.entries[0], lesson_status: 'svolta', bullets: ['Montato un circuito in serie e confrontato le misure.'], lab: { notes: labText, repo_url: longLink, goal: '', pitfall: '', bring: '' }, attachment_ids: [7, 8, 9] },
    { ...card.entries[0], hours: '3-4', room: 'LAB 2', lesson_status: 'svolta', bullets: ['Ripasso delle misure: laboratorio con dati precedenti.'], lab: { goal: 'Confrontare le misure', repo_url: '', pitfall: 'Controllare la portata', bring: 'Multimetro' }, attachment_ids: [] },
  ],
  attachments: [{ id: 10, width: 900, height: 350 }],
}

// Local, synthetic notes in three aspect ratios; no private uploads or remote assets.
export function photoSvg(id: number) {
  const [width, height] = id === 7 ? [450, 900] : id === 8 ? [1200, 350] : id === 9 ? [600, 600] : [900, 350]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#faf6e9"/><path d="M30 120 H${width - 30} M30 180 H${width - 30} M30 240 H${width - 30} M30 300 H${width - 30}" stroke="#d6dce2" stroke-width="2"/><g fill="#24495b" font-family="sans-serif"><text x="30" y="60" font-size="26">Appunti · ${id}</text><text x="30" y="108" font-size="20">V = R × I</text><text x="30" y="168" font-size="20">R = 220 Ω</text><text x="30" y="228" font-size="20">I = 0.02 A</text><text x="30" y="288" font-size="20">V = 4.4 V</text></g></svg>`
}

export async function presentationSetup(page: Page, { width = 1280, english = false, dark = false, view = 'day', savedCard = presentationCard } = {}) {
  let saved = structuredClone(savedCard)
  await page.setViewportSize({ width, height: 960 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ english, dark }) => {
    localStorage.setItem('ieri.lang', english ? 'en' : 'it')
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-03T14:00')
  }, { english, dark })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const attachment = path.match(/\/attachments\/(\d+)$/)
    if (attachment) await route.fulfill({ contentType: 'image/svg+xml', body: photoSvg(Number(attachment[1])) })
    else if (path.endsWith('/cards/2026-10-02')) {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        saved = { ...saved, ...body, revision: saved.revision + 1, attachments: body.attachment_ids.map((id: number) => saved.attachments.find(attachment => attachment.id === id) ?? { id, width: 0, height: 0 }) }
        await route.fulfill({ json: saved })
      } else await route.fulfill({ json: cardPage(saved) })
    } else if (path.includes('/subjects/INI/entries')) await route.fulfill({ json: saved.entries.map(entry => ({ ...entry, day: saved.day, author: info.viewer.member, updated_by: null, items: [] })) })
    else await route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
  await page.goto(`/tests/lab-presentation.html?view=${view}`)
  await page.getByRole('main').getByText(view === 'editor' ? (english ? 'Lab lesson' : 'Lezione in laboratorio') : savedCard.entries[0].bullets[0], { exact: true }).first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  return { saved: () => saved }
}
