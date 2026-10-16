import { locale } from './format'

export const TITLE_MAX = 120
export const BODY_MAX = 2000

export function reportDate(iso: string, lang: string) {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

/** Where the visitor came from: the link that opened the page passes it, otherwise the referrer on this site. */
export function originPage(state: unknown, fallback: string) {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from === 'string' && from.startsWith('/')) return from
  try {
    const ref = new URL(document.referrer)
    if (ref.origin === window.location.origin) return ref.pathname
  } catch {
    // No referrer, or not a URL.
  }
  return fallback
}
