import { useSyncExternalStore } from 'react'

declare const __APP_VERSION__: string

export type UpdateNotice = { kind: 'preparing'; key: string } | { kind: 'ready'; key: string }

type Status = { version: string; update_id: string | null }

const POLL_MS = 15_000
const POLL_PREPARING_MS = 8_000
const CONFIRM_MS = 8_000
const ERROR_MS = 120_000
const DISMISSED_KEY = 'recapp.update.dismissed'

// A build without a commit (local dev) adopts the first version the server reports.
let loaded: string | null = __APP_VERSION__ === 'dev' ? null : __APP_VERSION__
// A different version must be seen twice: during the switch, one request can still hit the old instance.
let candidate: string | null = null
let notice: UpdateNotice | null = null
let lastPoll = 0
let timer: number | undefined
let started = false
const listeners = new Set<() => void>()

function readDismissed(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

let dismissed = new Set(readDismissed())

function visible(): UpdateNotice | null {
  return notice && !dismissed.has(notice.key) ? notice : null
}

function emit() {
  listeners.forEach((l) => l())
}

function apply(s: Status): number {
  if (loaded === null) loaded = s.version
  const changed = s.version !== loaded
  const confirmed = changed && candidate === s.version
  // A banner that already said "updating" should become "ready" as soon as the new version answers,
  // instead of disappearing for a poll and looking like the notice broke.
  const wasPreparing = notice?.kind === 'preparing'
  let next: UpdateNotice | null = null
  if (changed && (confirmed || wasPreparing)) {
    next = { kind: 'ready', key: `ready:${s.version}` }
  } else if (!changed && s.update_id) {
    next = { kind: 'preparing', key: `preparing:${s.update_id}` }
  }
  const confirming = changed && !confirmed && !wasPreparing
  candidate = changed ? s.version : null
  if (next?.key !== notice?.key) {
    notice = next
    emit()
  }
  if (confirming) return CONFIRM_MS
  return next?.kind === 'preparing' ? POLL_PREPARING_MS : POLL_MS
}

async function poll() {
  window.clearTimeout(timer)
  lastPoll = Date.now()
  let wait = ERROR_MS
  try {
    const res = await fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' })
    if (res.ok) {
      const body = (await res.json()) as Status
      if (typeof body?.version === 'string') wait = apply(body)
    }
  } catch {
    // Offline or the check is down: the app keeps working, the notice just stays as it was.
  }
  timer = window.setTimeout(tick, wait)
}

function tick() {
  if (document.visibilityState === 'visible') poll()
  else timer = window.setTimeout(tick, POLL_MS)
}

function start() {
  if (started) return
  started = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastPoll > POLL_PREPARING_MS) poll()
  })
  poll()
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUpdateNotice() {
  return useSyncExternalStore(subscribe, visible)
}

/** Hides this notice (this version, or this deploy being prepared) for the rest of the session. */
export function dismissUpdate(key: string) {
  dismissed = new Set([...dismissed, key])
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
  } catch {
    // Private mode without storage: dismissal still holds until reload.
  }
  emit()
}
