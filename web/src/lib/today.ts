import type { CSSProperties, PointerEvent } from 'react'
import type { Entry, Item, Lesson, TodayInfo } from '../types'
import { daysBetween } from './clock'
import { hasEntrySummary } from './lab'

export type StopPhase = 'past' | 'now' | 'next' | null

/** One hour (or block of hours) of the day: the scheduled lesson with what was written about it. */
export interface TimelineStop {
  key: string
  subject_code: string
  lesson: Lesson | null
  entry: Entry | null
  phase: StopPhase
}

const sameHours = (lesson: Lesson, entry: Entry) => lesson.hours_label === entry.hours || lesson.hours.map(String).join('-') === entry.hours

/**
 * Lessons from the timetable, each with the notes written for that subject. Entries the
 * timetable does not know (substitutions, moved hours) become stops of their own, after them.
 */
export function buildTimeline(lessons: Lesson[], entries: Entry[], now: string | null, day: string): TimelineStop[] {
  const left = [...entries]
  const take = (lesson: Lesson) => {
    let index = left.findIndex((e) => e.subject_code === lesson.subject_code && sameHours(lesson, e))
    if (index < 0) index = left.findIndex((e) => e.subject_code === lesson.subject_code)
    return index < 0 ? null : left.splice(index, 1)[0]
  }
  const clock = now && now.slice(0, 10) === day ? now.slice(11, 16) : null
  const phase = (lesson: Lesson): StopPhase => {
    if (!clock) return null
    if (clock >= lesson.end) return 'past'
    return clock >= lesson.start ? 'now' : 'next'
  }
  const stops: TimelineStop[] = [...lessons]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((lesson) => ({ key: `${lesson.subject_code}-${lesson.hours_label}`, subject_code: lesson.subject_code, lesson, entry: take(lesson), phase: phase(lesson) }))
  left.forEach((entry, i) => stops.push({ key: `extra-${entry.subject_code}-${entry.hours}-${i}`, subject_code: entry.subject_code, lesson: null, entry, phase: null }))
  return stops
}

/** An entry is worth showing under its stop when it says something or the lesson did not go as planned. */
export const entryHasContent = (entry: Entry | null) => !!entry && (hasEntrySummary(entry) || entry.lesson_status !== 'svolta')

/** Items due soon, grouped by due day in date order. */
export function groupByDay(items: Item[]): { day: string; items: Item[] }[] {
  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.due_date, [...(groups.get(item.due_date) ?? []), item])
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, items: list }))
}

export type Urgency = 'now' | 'soon' | 'later'
export function urgency(today: string, due: string): Urgency {
  const diff = daysBetween(today, due)
  return diff <= 1 ? 'now' : diff === 2 ? 'soon' : 'later'
}

export type DayTone = 'published' | 'draft' | 'mine' | 'open' | 'no_school' | 'future' | 'waiting' | 'taken'

/** The one compact label that tells the state of the day at a glance. */
export function dayTone(data: TodayInfo): DayTone {
  switch (data.status) {
    case 'no_school': return 'no_school'
    case 'published': return 'published'
    case 'future': return 'future'
    case 'draft': return 'draft'
    case 'open': return data.is_me_scribe ? 'mine' : 'open'
    default:
      if (data.is_me_scribe) return 'mine'
      return data.override_reason === 'takeover' ? 'taken' : 'waiting'
  }
}

/** Position of each card in the opening sequence. */
export const enter = (i: number) => ({ '--i': i }) as CSSProperties

/** The glow under the mouse: decorative, so touch and pen never trigger it. */
export function spotlight(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return
  const box = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - box.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - box.top}px`)
}

