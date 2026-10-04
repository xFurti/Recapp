import type { Card, CardPage, ClassInfo } from '../src/types'

export const info: ClassInfo = {
  code: 'TEST', name: '4B', label: 'Classe di prova', is_demo: false,
  subjects: [
    { code: 'INI', name_it: 'Informatica e progettazione di sistemi informatici', name_en: 'Computer science and information systems design', color: '#347c91' },
    { code: 'MAT', name_it: 'Matematica', name_en: 'Mathematics', color: '#bb8c20' },
  ], hours: [],
  viewer: { kind: 'member', member: { id: 1, nick: 'Leo', color: '#347c91', role: 'admin' }, can_manage: true, read_only: false, tour_seen: true },
}
export const card: Card = {
  id: 1, day: '2026-10-02', status: 'draft', author: info.viewer.member, scribe: info.viewer.member,
  notes: 'Portare il computer', revision: 1, published_at: null, updated_at: '2026-10-02T15:00:00',
  entries: [
    { subject_code: 'INI', hours: '1-2', room: 'LAB 1', is_lab: true, lesson_status: 'supplenza', bullets: ['API e database'], lab: { goal: 'Salvare i dati', repo_url: 'https://example.com/lab', pitfall: 'Controllare la connessione', bring: 'Computer' }, attachment_ids: [7] },
    { subject_code: 'MAT', hours: '3', room: 'A102', is_lab: false, lesson_status: 'svolta', bullets: ['Derivate'], lab: null, attachment_ids: [] },
  ], items: [], attachments: [{ id: 8, width: 1, height: 1 }],
}
export function cardPage(saved: Card): CardPage {
  return {
    card: saved, lessons: [], next_lessons: {}, prev_published: null, next_published: null,
    state: { day: saved.day, is_school_day: true, no_school_reason: '', status: saved.status, scribe: info.viewer.member, override_reason: null, is_me_scribe: true, has_draft: true, can_write: true, can_takeover: false, can_pass: false, takeover_at: '' },
  }
}
