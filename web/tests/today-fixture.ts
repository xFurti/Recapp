import type { Card, ClassInfo, Item, MemberBrief, TodayInfo } from '../src/types'

export const me: MemberBrief = { id: 1, nick: 'Leo', color: '#347c91' }
export const giulia: MemberBrief = { id: 2, nick: 'Giulia', color: '#a02848' }
export const longNick = 'Massimilianoalessandrodellavalle'

const subjects = [
  { code: 'INF', name_it: 'Informatica', name_en: 'Computer science', color: '#347c91' },
  { code: 'MAT', name_it: 'Matematica', name_en: 'Mathematics', color: '#bb8c20' },
  { code: 'ITA', name_it: 'Lingua e letteratura italiana', name_en: 'Italian language and literature', color: '#a02848' },
  { code: 'TPS', name_it: 'Tecnologie e progettazione di sistemi', name_en: 'Systems technology and design', color: '#4a7512' },
  { code: 'ING', name_it: 'Inglese', name_en: 'English', color: '#1898c8' },
]

export function todayClass(who: string): ClassInfo {
  const role = who === 'admin' ? 'admin' : 'member'
  return {
    code: 'TEST', name: '4B', label: 'Classe di prova', is_demo: false, subjects, hours: [],
    viewer: { kind: 'member', member: { ...me, role }, can_manage: role === 'admin', read_only: false, tour_seen: true },
  }
}

const item = (id: number, type: Item['type'], subject: string | null, title: string, due: string, extra: Partial<Item> = {}): Item => ({
  id, type, subject_code: subject, title, due_date: due, due_time: null, source: 'detto in classe', link: '', attachment_id: null,
  author: giulia, status: 'published', card_day: null, thanks: 2, thanked: false, can_thank: true, ...extra,
})

export const soon: Item[] = [
  item(11, 'verifica', 'MAT', 'Verifica sulle derivate e sullo studio di funzione', '2026-10-15'),
  item(12, 'compito', 'ITA', 'Leggere il canto V dell’Inferno', '2026-10-15', { link: 'https://example.com/canto' }),
  item(13, 'lab', 'TPS', 'Portare il portatile carico', '2026-10-16'),
  item(14, 'evento', null, 'Assemblea di classe', '2026-10-17'),
  item(15, 'compito', 'ING', 'Esercizi 3 e 4 a pagina 52', '2026-10-17'),
]

const assigned = [
  item(21, 'compito', 'MAT', 'Esercizi 1–10 pagina 112', '2026-10-16', { card_day: '2026-10-14', author: giulia }),
  item(22, 'evento', null, 'Uscita didattica al museo', '2026-10-20', { card_day: '2026-10-14', author: giulia }),
]

export function publishedCard(author: MemberBrief = giulia): Card {
  return {
    id: 9, day: '2026-10-14', status: 'published', author, updated_by: null, scribe: author, notes: 'Chi era assente recuperi gli appunti di matematica.',
    revision: 3, published_at: '2026-10-14T13:10:00Z', updated_at: '2026-10-14T13:10:00Z', attachments: [],
    entries: [
      { subject_code: 'INF', hours: '1-2', room: 'LAB 2', is_lab: true, lesson_status: 'svolta', bullets: ['Introduzione alle API REST', 'Prima richiesta GET con fetch'], lab: null, attachment_ids: [] },
      { subject_code: 'MAT', hours: '3', room: 'A12', is_lab: false, lesson_status: 'svolta', bullets: ['Derivate di funzioni composte', 'Esempi alla lavagna e correzione dei compiti assegnati la settimana scorsa'], lab: null, attachment_ids: [] },
      { subject_code: 'ITA', hours: '4', room: 'A12', is_lab: false, lesson_status: 'non_svolta', bullets: [], lab: null, attachment_ids: [] },
    ],
    items: assigned,
  }
}

const lessons: TodayInfo['lessons'] = [
  { subject_code: 'INF', hours: [1, 2], hours_label: '1-2', start: '08:00', end: '09:50', room: 'LAB 2', is_lab: true },
  { subject_code: 'MAT', hours: [3], hours_label: '3', start: '10:00', end: '10:55', room: 'A12', is_lab: false },
  { subject_code: 'ITA', hours: [4], hours_label: '4', start: '11:05', end: '12:00', room: 'A12', is_lab: false },
  { subject_code: 'TPS', hours: [5], hours_label: '5', start: '12:00', end: '12:55', room: 'LAB 1', is_lab: true },
  { subject_code: 'ING', hours: [6], hours_label: '6', start: '13:00', end: '13:50', room: 'A12', is_lab: false },
]

export type Scenario = 'published' | 'mine' | 'my_draft' | 'draft' | 'open' | 'passed' | 'waiting' | 'taken' | 'no_school' | 'future' | 'admin'

export function todayInfo(scenario: Scenario, { empty = false, nick }: { empty?: boolean; nick?: string } = {}): TodayInfo {
  const scribe = nick ? { ...giulia, nick } : giulia
  const base: TodayInfo = {
    day: '2026-10-14', now: '2026-10-14T16:00:00+02:00', is_school_day: true, no_school_reason: '', status: 'not_started',
    scribe, override_reason: null, is_me_scribe: false, has_draft: false, can_write: false, can_takeover: false, can_pass: false,
    takeover_at: '18:00', lessons, card: null, next_school_day: null, upcoming_soon: empty ? [] : soon, next_lessons: {}, open_corrections: 0,
  }
  switch (scenario) {
    case 'published': return { ...base, status: 'published', card: publishedCard(scribe) }
    case 'mine': return { ...base, scribe: me, is_me_scribe: true, can_write: true, can_pass: true }
    case 'my_draft': return { ...base, status: 'draft', scribe: me, is_me_scribe: true, has_draft: true, can_write: true, can_pass: true, draft_updated_at: '2026-10-14T14:20:00Z' }
    case 'draft': return { ...base, status: 'draft', draft_updated_at: '2026-10-14T14:20:00Z' }
    case 'open': return { ...base, status: 'open', can_takeover: true }
    case 'passed': return { ...base, status: 'open', scribe: null, override_reason: 'pass', can_takeover: true }
    case 'waiting': return base
    case 'taken': return { ...base, override_reason: 'takeover' }
    case 'future': return { ...base, status: 'future' }
    case 'admin': return { ...base, can_write: true, open_corrections: 2 }
    case 'no_school': return {
      ...base, status: 'no_school', is_school_day: false, no_school_reason: 'Festa del patrono', lessons: [], scribe: null,
      next_school_day: { day: '2026-10-15', scribe: { ...giulia, nick: nick ?? 'Marco' } },
    }
  }
}
