import { expect, test } from '@playwright/test'
import i18next from 'i18next'
import it from '../src/i18n/it.json' with { type: 'json' }
import en from '../src/i18n/en.json' with { type: 'json' }
import { calendarEvent, calendarIcs, googleCalendarUrl } from '../src/lib/calendar'
import { info, items } from './calendar-fixture'

const translations = i18next.createInstance()
test.beforeAll(async () => {
  await translations.init({ resources: { it: { translation: it }, en: { translation: en } }, lng: 'it', interpolation: { escapeValue: false } })
})

for (const [day, end] of [
  ['2026-03-29', '20260330'], ['2026-10-25', '20261026'],
  ['2026-01-31', '20260201'], ['2026-12-31', '20270101'],
  ['2028-02-28', '20280229'], ['2028-02-29', '20280301'], ['2027-02-28', '20270301'],
]) {
  test(`all-day export preserves ${day} with exclusive end ${end}`, () => {
    const event = calendarEvent({ ...items[1], due_date: day }, info, info.subjects, translations.getFixedT('it'), 'it', 'https://recapp.example')
    const url = new URL(googleCalendarUrl(event))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe(`${day.replaceAll('-', '')}/${end}`)
    const ics = calendarIcs(event, new Date('2026-10-12T17:30:00Z'))
    expect(ics).toContain(`DTSTART;VALUE=DATE:${day.replaceAll('-', '')}\r\nDTEND;VALUE=DATE:${end}\r\n`)
    expect(ics).toContain('DTSTAMP:20261012T173000Z\r\n')
    expect(ics).not.toContain('2330')
    expect(ics).not.toContain('TZID')
  })
}

test('Italian and English exports select only class, subject, source, title and link', () => {
  for (const [lang, title, description] of [
    ['it', 'Verifica · Storia · capitolo 12', 'Classe: 4B Informatica\nFonte: Classroom\nhttps://example.com/lezione?a=1&b=2\nAggiunto su Recapp\nhttps://recapp.example/c/TEST/in-arrivo'],
    ['en', 'Test · History · capitolo 12', 'Class: 4B Informatica\nSource: Classroom\nhttps://example.com/lezione?a=1&b=2\nAdded on Recapp\nhttps://recapp.example/c/TEST/in-arrivo'],
  ]) {
    const event = calendarEvent(items[1], info, info.subjects, translations.getFixedT(lang), lang, 'https://recapp.example')
    expect(event.title).toBe(title)
    expect(event.description).toBe(description)
    const url = new URL(googleCalendarUrl(event))
    expect(url.searchParams.get('text')).toBe(title)
    expect(url.searchParams.get('details')).toBe(description)
    expect(JSON.stringify(event)).not.toContain('PRIVATE_')
    expect(calendarIcs(event)).not.toMatch(/ATTENDEE|ORGANIZER|PRIVATE_NICK/)
    expect(event.uid).toBe('recapp-TEST-2@recapp.example')
  }
})

test('missing optional data and encoded class codes remain readable', () => {
  const event = calendarEvent({ ...items[0], source: '' as typeof items[0]['source'] }, { code: '4 B/è', name: '4B' }, [], translations.getFixedT('it'), 'it', 'https://recapp.example')
  expect(event.title).toBe('Compito · esercizi 12-15 pag. 112')
  expect(event.description).toBe('Classe: 4B\nFonte: Detto in classe\nAggiunto su Recapp\nhttps://recapp.example/c/4%20B%2F%C3%A8/in-arrivo')
})

test('iCalendar escapes text, folds UTF-8 at 75 bytes and prevents property injection', () => {
  const title = 'Attività 🗓️; città, \\ prove\r\nBEGIN:VEVENT\nATTENDEE:private@example.com '.repeat(4)
  const event = calendarEvent({ ...items[2], title }, info, info.subjects, translations.getFixedT('it'), 'it', 'https://recapp.example')
  const ics = calendarIcs(event)
  expect(ics.endsWith('\r\n')).toBe(true)
  expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
  for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
  expect(ics).not.toContain('�')
  const unfolded = ics.replace(/\r\n /g, '')
  expect(unfolded).toContain('Attività 🗓️\\; città\\, \\\\ prove\\nBEGIN:VEVENT\\nATTENDEE:private@example.com')
  expect(unfolded.split('\r\n').filter(line => line === 'BEGIN:VEVENT')).toHaveLength(1)
  expect(unfolded.split('\r\n').some(line => line.startsWith('ATTENDEE:'))).toBe(false)
})
