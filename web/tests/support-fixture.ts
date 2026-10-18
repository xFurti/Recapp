import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import type { OwnerClass, ReportDetail } from '../src/types'
import type { Release } from '../src/lib/releases'

export const release = JSON.parse(readFileSync('../release-notes/2026-10-13-novita.json', 'utf8')) as Release
export const releases = [release, {
  ...release, id: '2026.09.30.1', published_at: '2026-09-30T15:00:00Z',
  title: { it: 'Appunti e scadenze più facili da ritrovare', en: 'Find your notes and deadlines more easily' },
}]
export const classes: OwnerClass[] = Array.from({ length: 12 }, (_, i) => ({
  code: `TEST${i + 1}`, name: `${i + 1}BI`,
  label: i === 0 ? '4ª BI · Informatica e telecomunicazioni' : `${i + 1}ª A · Scienze e tecnologie applicate`,
  is_demo: i === 1, last_published: i === 2 ? null : '2026-10-16',
  published_this_week: i === 2 ? 0 : 5, members_total: 26, members_active: 24, admins: ['Ada', 'Luca'],
}))
export const reports: ReportDetail[] = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1, kind: i % 2 ? 'feature' : 'bug',
  title: [
    'Il calendario non mostra tutte le attività della settimana',
    'Un modo più semplice per ritrovare gli appunti',
    'Il testo lungo della materia esce dal riquadro',
    'Aggiungere indicazioni per i nuovi compagni',
  ][i],
  body: 'Segnalazione di prova: descrizione del problema e del risultato atteso. Nessun dato personale.',
  status: (['new', 'in_progress', 'closed', 'new'] as const)[i],
  created_at: '2026-10-16T15:00:00Z', updated_at: '2026-10-16T15:00:00Z',
  has_image: false, is_demo: i === 1, image_width: 0, image_height: 0,
  context: { page: '/c/TEST/ieri', language: 'it', theme: 'light', version: 'dev', class_label: '4ª BI · Informatica', class_code: 'TEST', nick: 'Ada', role: 'member' },
}))

/** Render production routes; simulate HTTP responses only, with fictitious data. */
export async function fixture(page: Page, role: 'anonymous' | 'member' | 'owner' = 'anonymous') {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: role === 'owner'
      ? { kind: 'owner', owner: { username: 'test', display_name: 'Dirigenza · account di prova' } }
      : role === 'member' ? { kind: 'member', member: { id: 1, nick: 'Ada', role: 'member' }, classroom: classes[0] }
        : { kind: 'anonymous' } })
    if (path === '/api/releases') return route.fulfill({ json: { version: 'dev', current: release.id, releases } })
    if (path === '/api/release-preference') return route.fulfill({ json: { seen: [release.id] } })
    if (path === '/api/owner/classes') return route.fulfill({ json: classes })
    if (path === '/api/reports/mine' || path === '/api/owner/reports') return route.fulfill({ json: reports })
    if (path === '/api/owner/holidays') return route.fulfill({ json: [{ day: '2026-11-01', label: 'Festività nazionale', kind: 'festivita' }] })
    return route.fulfill({ json: { version: 'dev', status: 'idle' } })
  })
}
