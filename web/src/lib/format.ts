import type { TFunction } from 'i18next'
import type { Subject } from '../types'
import { daysBetween, parseDay, todayIso } from './clock'

export const locale = (lang: string) => (lang === 'en' ? 'en-GB' : 'it-IT')

/** "gio 1 ott" */
export function shortDay(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'short', day: 'numeric', month: 'short' })
    .format(parseDay(iso))
    .replace(/\./g, '')
}

/** "giovedì 1 ottobre" */
export function longDay(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(parseDay(iso))
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

export function timeOf(isoDateTime: string | null | undefined, lang: string): string {
  if (!isoDateTime) return ''
  return new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(
    new Date(isoDateTime),
  )
}

/** "Oggi", "Domani", "Ieri" or "gio 1 ott" */
export function relativeDay(iso: string, t: TFunction, lang: string): string {
  const diff = daysBetween(todayIso(), iso)
  if (diff === 0) return t('dates.today')
  if (diff === 1) return t('dates.tomorrow')
  if (diff === -1) return t('dates.yesterday')
  return capitalize(shortDay(iso, lang))
}

export function countdown(iso: string, t: TFunction): string {
  const diff = daysBetween(todayIso(), iso)
  if (diff === 0) return t('dates.today')
  if (diff === 1) return t('dates.tomorrow')
  if (diff > 1) return t('dates.in_days', { count: diff })
  return t('dates.days_ago', { count: -diff })
}

export function subjectName(subjects: Subject[] | undefined, code: string | null | undefined, lang: string): string {
  if (!code) return ''
  const s = subjects?.find((x) => x.code === code)
  if (!s) return code
  return lang === 'en' ? s.name_en : s.name_it
}

export function subjectColor(subjects: Subject[] | undefined, code: string | null | undefined): string {
  return subjects?.find((x) => x.code === code)?.color ?? '#6b6570'
}
