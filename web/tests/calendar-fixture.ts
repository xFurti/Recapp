import type { Card, ClassInfo, Item, TodayInfo } from '../src/types'

export const info: ClassInfo = {
  code: 'TEST', name: '4B Informatica', label: '4B · Marconi', is_demo: false,
  subjects: [{ code: 'STO', name_it: 'Storia', name_en: 'History', color: '#347c91' }], hours: [],
  viewer: { kind: 'member', member: { id: 91, nick: 'PRIVATE_NICK', color: '#347c91', role: 'member' }, can_manage: false, read_only: false, tour_seen: true },
}

export const items: Item[] = (['compito', 'verifica', 'evento', 'lab'] as const).map((type, i) => ({
  id: i + 1, type, subject_code: i === 0 ? null : 'STO',
  title: ['esercizi 12-15 pag. 112', 'capitolo 12', 'Incontro, attività; città 🗓️', 'Repository \\ prove'][i],
  due_date: '2026-10-25', due_time: '23:30', source: i === 0 ? 'detto in classe' : 'Classroom',
  link: i === 0 ? '' : 'https://example.com/lezione?a=1&b=2', attachment_id: i === 1 ? 7 : null,
  author: info.viewer.member, status: 'published', card_day: '2026-10-12', can_edit: true,
}))

export const card: Card = {
  id: 1, day: '2026-10-12', status: 'published', author: info.viewer.member, scribe: info.viewer.member,
  notes: 'PRIVATE_NOTES', revision: 1, published_at: '2026-10-12T15:00:00', updated_at: null,
  entries: [{ subject_code: 'STO', hours: '1', room: 'A1', is_lab: false, lesson_status: 'svolta', bullets: ['La rivoluzione industriale'], lab: null, attachment_ids: [] }],
  items, attachments: [],
}

export const today: TodayInfo = {
  day: '2026-10-12', now: '2026-10-12T10:00:00', status: 'not_started',
  is_school_day: true, no_school_reason: '', scribe: info.viewer.member, override_reason: null,
  is_me_scribe: false, has_draft: false, can_write: false, can_takeover: false, can_pass: false, takeover_at: '18:00',
  lessons: [], card: null, next_school_day: null, upcoming_soon: items, next_lessons: {}, open_corrections: 0,
}
