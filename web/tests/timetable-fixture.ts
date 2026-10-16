import type { Page } from '@playwright/test'
import type { ClassInfo, TimetableData, TodayInfo } from '../src/types'

const subjects = [
  ['INI', 'Informatica', 'Computer Science', '#1898C8'],
  ['SRI', 'Sistemi e reti', 'Networks', '#8038B8'],
  ['TPI', 'TPSIT', 'Systems Design', '#80B830'],
  ['TCI', 'Telecomunicazioni', 'Telecom', '#D99A00'],
  ['MAT', 'Matematica', 'Math', '#E01058'],
  ['LIT', 'Italiano', 'Italian', '#A02848'],
  ['STO', 'Storia', 'History', '#8A5A2B'],
  ['ING', 'Inglese', 'English', '#0E7490'],
  ['SMS', 'Scienze motorie', 'PE', '#4D7C0F'],
  ['IRC', 'Religione', 'Religion', '#6B7280'],
].map(([code, name_it, name_en, color]) => ({ code, name_it, name_en, color }))

const week = [
  [['LIT', 'A215'], ['LIT', 'A215'], ['SRI', 'A105'], ['SMS', 'Palestra'], ['IRC', 'A161'], ['INI', 'A122']],
  [['MAT', 'A064'], ['MAT', 'A064'], ['SRI', 'A105'], ['LIT', 'A215'], ['INI', 'A120'], ['INI', 'A120']],
  [['TPI', 'L143'], ['TPI', 'L143'], ['ING', 'A315'], ['SMS', 'Palestra'], ['INI', 'L143'], ['INI', 'L143'], ['INI', 'L143']],
  [['TCI', 'L348'], ['TCI', 'L348'], ['STO', 'A215'], ['STO', 'A215'], ['TPI', 'A121'], ['ING', 'A315']],
  [['ING', 'A316'], ['TCI', 'A323'], ['LIT', 'A216'], ['SRI', 'L143'], ['SRI', 'L143'], ['MAT', 'A263'], ['MAT', 'A263']],
]

// The five-day, seven-period 4BI timetable from api/school_data.py.
export const timetable: TimetableData = {
  hours: ['08:00/08:50', '08:50/09:40', '09:50/10:40', '10:50/11:40', '11:50/12:40', '12:50/13:40', '13:40/14:30']
    .map((time, index) => ({ hour: index + 1, start: time.split('/')[0], end: time.split('/')[1] })),
  subjects, timezone: 'Europe/Rome', can_edit: true,
  slots: week.flatMap((day, weekday) => day.map(([subject_code, room], index) => ({ weekday, hour: index + 1, subject_code, room, is_lab: room.startsWith('L') }))),
}

export const timetableInfo: ClassInfo = {
  code: 'TEST', name: '4BI', label: '4ª BI · Informatica', is_demo: false,
  subjects, hours: timetable.hours,
  viewer: { kind: 'member', member: { id: 1, nick: 'Leo', color: '#1898C8', role: 'admin' }, can_manage: true, read_only: false, tour_seen: true },
}

const today: TodayInfo = {
  day: '2026-10-12', now: '2026-10-12T18:50:00+02:00', is_school_day: true,
  status: 'published', no_school_reason: '', scribe: timetableInfo.viewer.member,
  override_reason: null, is_me_scribe: false, has_draft: false, can_write: false, can_takeover: false, can_pass: false,
  takeover_at: '', lessons: [], card: null, next_school_day: null, upcoming_soon: [], next_lessons: {}, open_corrections: 0,
}

export async function setupTimetable(page: Page, { width = 390, dark = false, lang = 'it' }: { width?: number; dark?: boolean; lang?: 'it' | 'en' } = {}) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(({ dark, lang }) => {
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.lang', lang)
  }, { dark, lang })
  let saved = structuredClone(timetable)
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/classes/TEST/timetable') {
      if (route.request().method() === 'PUT') saved = { ...saved, ...route.request().postDataJSON() }
      return route.fulfill({ json: saved })
    }
    if (path === '/api/classes/TEST') return route.fulfill({ json: timetableInfo })
    if (path === '/api/classes/TEST/today') return route.fulfill({ json: today })
    if (path === '/api/me') return route.fulfill({ json: { kind: 'member', member: timetableInfo.viewer.member, classroom: timetableInfo } })
    if (path === '/api/version') return route.fulfill({ json: { version: 'dev' } })
    if (path === '/api/updates') return route.fulfill({ json: { version: 'dev', status: 'idle' } })
    return route.fulfill({ status: 404, json: { detail: `Unexpected test request: ${path}` } })
  })
  await page.goto('/c/TEST/classe?tab=timetable')
}
