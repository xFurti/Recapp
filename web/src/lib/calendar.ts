import type { TFunction } from 'i18next'
import type { Classroom, Item, Subject } from '../types'
import { subjectName } from './format'

export interface CalendarEvent {
  uid: string
  title: string
  description: string
  startDate: string
  endDate: string
  url: string
}

function nextDate(day: string): string {
  // UTC is used only for calendar arithmetic; due_date is never converted to local time.
  const next = new Date(`${day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10).replaceAll('-', '')
}

export function calendarEvent(
  item: Pick<Item, 'id' | 'type' | 'subject_code' | 'title' | 'due_date' | 'source' | 'link'>,
  classroom: Pick<Classroom, 'code' | 'name'>,
  subjects: Subject[],
  t: TFunction,
  lang: string,
  origin: string,
): CalendarEvent {
  const url = new URL(`/c/${encodeURIComponent(classroom.code)}/in-arrivo`, origin).href
  return {
    uid: `recapp-${encodeURIComponent(classroom.code)}-${item.id}@${new URL(origin).host}`,
    title: [t(`types.${item.type}`), subjectName(subjects, item.subject_code, lang), item.title].filter(Boolean).join(' · '),
    description: [
      `${t('calendar.class')}: ${classroom.name}`,
      `${t('item_form.source')}: ${t(`sources.${item.source || 'detto in classe'}`, { defaultValue: item.source })}`,
      item.link,
      `${t('calendar.added_on')}\n${url}`,
    ].filter(Boolean).join('\n'),
    startDate: item.due_date.replaceAll('-', ''),
    endDate: nextDate(item.due_date),
    url,
  }
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const url = new URL('https://calendar.google.com/calendar/render')
  url.search = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${event.startDate}/${event.endDate}`,
    details: event.description,
  }).toString()
  return url.href
}

function escapeText(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
}

function foldLine(line: string): string {
  const encoder = new TextEncoder()
  let result = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 75) {
      result += '\r\n '
      bytes = 1
    }
    result += char
    bytes += size
  }
  return result
}

export function calendarIcs(event: CalendarEvent, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Recapp//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${event.startDate}`,
    `DTEND;VALUE=DATE:${event.endDate}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    'CLASS:PRIVATE',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n'
}

export function downloadCalendar(event: CalendarEvent): void {
  const url = URL.createObjectURL(new Blob([calendarIcs(event)], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `recapp-${event.startDate}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give Safari time to consume the download before releasing its object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
