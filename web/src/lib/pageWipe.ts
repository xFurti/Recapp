/** Cover and reveal share one duration. The CSS animation reads the same number from the stage. */
export const PAGE_WIPE_MS = 200

let pending: HTMLElement | null = null

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function shellCode(pathname: string) {
  const match = /^\/c\/([^/]+)/.exec(pathname)
  if (!match || pathname.includes('/entra')) return null
  return match[1]
}

/** True when a navigation should play the clip wipe: a real page change inside the same class. */
export function pageWipeEnabled(from: string, to: string) {
  if (reducedMotion()) return false
  let next = to
  try {
    next = new URL(to, window.location.origin).pathname
  } catch {
    /* keep the raw path */
  }
  if (next === from) return false
  const current = shellCode(from)
  const destination = shellCode(next)
  return current !== null && current === destination
}

/** Snapshot of the page currently on screen, taken before the router swaps it. */
export function stashPageClone() {
  const live = document.querySelector<HTMLElement>('[data-page-live]')
  if (!live) return
  const clone = live.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-page-live')
  clone.querySelectorAll<HTMLElement>('[id]').forEach((node) => node.removeAttribute('id'))
  clone.setAttribute('aria-hidden', 'true')
  clone.inert = true
  pending = clone
}

export function takePageClone() {
  const clone = pending
  pending = null
  return clone
}

export function discardPageClone() {
  pending = null
}
