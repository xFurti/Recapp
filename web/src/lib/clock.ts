const KEY = 'ieri.simulatedNow'

/** Simulated "now" (local ISO without timezone, e.g. 2026-09-30T18:30).
 *  Sent to the API as X-Ieri-Now; honoured only in development and in the demo class. */
export function getSimulatedNow(): string | null {
  return localStorage.getItem(KEY)
}

export function setSimulatedNow(value: string | null) {
  if (value) localStorage.setItem(KEY, value)
  else localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('ieri-time'))
}

export function now(): Date {
  const sim = getSimulatedNow()
  return sim ? new Date(sim) : new Date()
}

export function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(): string {
  return isoDay(now())
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso)
  d.setDate(d.getDate() + days)
  return isoDay(d)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseDay(toIso).getTime() - parseDay(fromIso).getTime()) / 86400000)
}
