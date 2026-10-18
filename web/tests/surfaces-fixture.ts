import type { Page } from '@playwright/test'
import type { Card, ClassInfo, DayStatus, Item, TodayInfo } from '../src/types'

export const surfacePaths = ['/c/TEST', '/c/TEST/giorno/2026-10-19', '/c/TEST/in-arrivo']

/** Real production routes; only HTTP responses are simulated. No private class data. */
export async function setupSurfaces(page: Page, {
  lang = 'it', dark = false, long = false, status = 'published' as DayStatus, important = true, mine = false,
} = {}) {
  const author = { id: 2, nick: long ? 'Alessandra'.repeat(8) : 'Ada', color: '#a02848' }
  const viewer = { id: 1, nick: 'Leo', color: '#1898c8', role: 'admin' as const }
  const info: ClassInfo = {
    code: 'TEST', name: '4B Informatica', label: '4B · Classe di prova', is_demo: false,
    subjects: [
      { code: 'INI', name_it: long ? 'Informatica'.repeat(9) : 'Informatica', name_en: long ? 'ComputerScience'.repeat(9) : 'Computer science', color: '#1898c8' },
      { code: 'MAT', name_it: 'Matematica', name_en: 'Mathematics', color: '#8038b8' },
    ], hours: [],
    viewer: { kind: 'member', member: viewer, can_manage: true, read_only: false, tour_seen: true },
  }
  const items: Item[] = (['compito', 'verifica', 'evento', 'lab'] as const).map((type, index) => ({
    id: index + 10, type, subject_code: index % 2 ? 'MAT' : 'INI',
    title: [
      'Completare gli esercizi sulle funzioni e confrontare i risultati in classe',
      'Verifica: equazioni e disequazioni, capitoli 3 e 4',
      'Incontro con il gruppo del progetto di classe',
      'Preparare il repository e rileggere gli appunti di laboratorio',
    ][index] + (long ? ' ContenutoMoltoLungoSenzaSpazi'.repeat(8) : ''),
    due_date: index === 1 ? '2026-10-20' : '2026-10-21', due_time: null,
    source: index % 2 ? 'Classroom' : 'detto in classe', link: 'https://example.org/materiale', attachment_id: null,
    author, status: 'published', card_day: '2026-10-19', can_edit: true, can_request_correction: true,
    can_review_corrections: true, pending_corrections: index === 0 && important ? 1 : 0,
    correction_count: index === 0 && important ? 1 : 0, thanks: 3, thanked: false, can_thank: true,
  }))
  const card: Card = {
    id: 1, day: '2026-10-19', status: 'published', author, updated_by: viewer, scribe: author,
    notes: 'Per il prossimo incontro portare il quaderno e il computer carico.',
    revision: 2, published_at: '2026-10-19T12:10:00Z', updated_at: '2026-10-19T13:00:00Z',
    entries: [
      { subject_code: 'INI', hours: '1-2', room: 'LAB 1', is_lab: true, lesson_status: 'svolta',
        bullets: ['Abbiamo progettato una piccola API per raccogliere e organizzare gli appunti.', 'Esempi di richieste, risposte e gestione degli errori.'],
        lab: { notes: 'Salvare le modifiche nel repository del gruppo.\nControllare insieme i risultati prima della consegna.', repo_url: 'https://example.org/progetto', goal: '', pitfall: '', bring: '' }, attachment_ids: [] },
      { subject_code: 'MAT', hours: '3', room: 'A102', is_lab: false, lesson_status: 'verifica', bullets: ['Ripasso delle equazioni e confronto tra i metodi di risoluzione.'], lab: null, attachment_ids: [] },
    ], items: items.slice(0, 1), attachments: [],
  }
  const today: TodayInfo = {
    day: card.day, now: '2026-10-19T15:30:00+02:00', status, is_school_day: status !== 'no_school',
    draft_updated_at: status === 'draft' ? '2026-10-19T13:00:00Z' : undefined,
    no_school_reason: status === 'no_school' ? 'weekend' : '', scribe: mine ? viewer : author, override_reason: null,
    is_me_scribe: mine, has_draft: status === 'draft', can_write: true, can_takeover: status === 'open', can_pass: mine, takeover_at: '18:00',
    lessons: card.entries.map((entry, index) => ({ subject_code: entry.subject_code, hours: [index + 1], hours_label: String(index + 1), start: '08:00', end: '09:00', room: entry.room, is_lab: entry.is_lab })),
    card: status === 'published' ? card : null, next_school_day: { day: '2026-10-20', scribe: author },
    upcoming_soon: [...items.slice(0, 2)].sort((a, b) => a.due_date.localeCompare(b.due_date)), next_lessons: {}, open_corrections: important ? 1 : 0,
  }
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-19T15:30')
  }, { lang, dark })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api', '')
    const responses: Record<string, unknown> = {
      '/me': { kind: 'member', member: viewer, classroom: info },
      '/classes/TEST': info,
      '/classes/TEST/today': today,
      '/classes/TEST/cards/2026-10-19': { card, state: today, lessons: today.lessons, next_lessons: {}, prev_published: null, next_published: null },
      '/classes/TEST/upcoming': [...items].sort((a, b) => a.due_date.localeCompare(b.due_date)),
      '/classes/TEST/upcoming/corrections': { pending_count: important ? 1 : 0, items: important ? [{ item: items[0], pending_count: 1 }] : [] },
      '/classes/TEST/upcoming/10/corrections': { item: items[0], can_review: true, requests: [] },
      '/classes/TEST/cards/2026-10-19/feedback': { thanks: 4, thanked: false, can_thank: true, open_corrections: 0, comments: [] },
      '/healthz': { ok: true, version: 'dev' },
    }
    if (path.endsWith('/thanks')) await route.fulfill({ json: { thanks: 4, thanked: true } })
    else await route.fulfill({ json: responses[path] ?? {} })
  })
  return { card, items, today }
}
