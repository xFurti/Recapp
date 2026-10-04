import { useEffect, useState } from 'react'
import { parseDay } from './clock'
import { capitalize, locale } from './format'
import type { TimetableData, TodayInfo } from '../types'

export type Slot = TimetableData['slots'][number]

const MONDAY = new Date(2026, 8, 28)

export function weekdayName(i: number, lang: string, style: 'short' | 'long' = 'long') {
  const d = new Date(MONDAY)
  d.setDate(d.getDate() + i)
  return capitalize(new Intl.DateTimeFormat(locale(lang), { weekday: style }).format(d).replace(/\.$/, ''))
}

/** Same rule as api/schedule.py: the demo runs every day and reuses Monday/Tuesday at the weekend. */
function timetableWeekday(iso: string, demo: boolean) {
  const wd = (parseDay(iso).getDay() + 6) % 7
  return wd >= 5 && demo ? wd - 5 : wd
}

export type SchoolClock = { day: string; time: string; isSchoolDay: boolean; nextSchoolDay: string | null }

/** "Now" in the school's timezone, from the server's clock (which honours the simulated time in the demo). */
export function useSchoolClock(today: TodayInfo | undefined, fetchedAt: number, timezone: string): SchoolClock | null {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!today) return null
  const at = new Date(new Date(today.now).getTime() + Math.max(0, tick - fetchedAt))
  let parts: Record<string, string>
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(at)
        .map((p) => [p.type, p.value]),
    )
  } catch {
    return null
  }
  const day = `${parts.year}-${parts.month}-${parts.day}`
  // Past midnight the server's school-day answer is stale: highlight nothing rather than guess.
  if (day !== today.day) return null
  return { day, time: `${parts.hour}:${parts.minute}`, isSchoolDay: today.is_school_day, nextSchoolDay: today.next_school_day?.day ?? null }
}

export const validTime = (s: string | undefined) => !!s && /^\d{2}:\d{2}$/.test(s)

export type TimetableModel = {
  days: number[]
  todayWd: number | null
  nextWd: number | null
  nextDay: string | null
  currentHour: number | null
  defaultDay: number
}

export function timetableModel(data: TimetableData, clock: SchoolClock | null, demo: boolean): TimetableModel {
  const withSlots = new Set(data.slots.map((s) => s.weekday))
  const days = [...new Set([0, 1, 2, 3, 4, ...withSlots])].sort((a, b) => a - b)
  let todayWd: number | null = null
  let currentHour: number | null = null
  if (clock?.isSchoolDay) {
    const wd = timetableWeekday(clock.day, demo)
    if (withSlots.has(wd)) {
      todayWd = wd
      const h = data.hours.find((x) => validTime(x.start) && validTime(x.end) && x.start <= clock.time && clock.time < x.end)
      if (h && data.slots.some((s) => s.weekday === wd && s.hour === h.hour)) currentHour = h.hour
    }
  }
  const nextDay = todayWd === null ? clock?.nextSchoolDay ?? null : null
  const nextWd = nextDay && withSlots.has(timetableWeekday(nextDay, demo)) ? timetableWeekday(nextDay, demo) : null
  const defaultDay = todayWd ?? nextWd ?? days.find((d) => withSlots.has(d)) ?? days[0]
  return { days, todayWd, nextWd, nextDay: nextWd === null ? null : nextDay, currentHour, defaultDay }
}
