import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import type { StreakInfo } from '../types'

const motionQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribe = (notify: () => void) => {
  const query = motionQuery()
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => motionQuery().matches, () => true)

type Observation = { record: number; current: number; latest: string }
const observations = new Map<string, Observation>()

function previousObservation(key: string): Observation | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (saved && Number.isFinite(saved.record) && Number.isFinite(saved.current) && typeof saved.latest === 'string') return saved
  } catch { /* Storage is optional; the in-memory baseline still survives navigation. */ }
  return observations.get(key)
}

/** Observe real publications, never infer a new record from mounting an existing counter. */
export function useStreakFeedback(scope: string, streak?: StreakInfo) {
  const reduced = useReducedMotion()
  const [feedback, setFeedback] = useState<'record' | 'advance' | undefined>()
  const key = `recapp.streak-observation.${scope}`
  useEffect(() => {
    if (!streak) return
    const previous = previousObservation(key)
    const latest = streak.days.filter(d => d.status === 'published').map(d => d.day).sort().at(-1) || ''
    const next = { record: Math.max(previous?.record ?? 0, streak.record), current: streak.current, latest: latest > (previous?.latest || '') ? latest : (previous?.latest || '') }
    observations.set(key, next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Private mode. */ }
    const advanced = previous && latest > previous.latest && (streak.current > previous.current || latest === streak.today)
    if (!advanced || reduced) return
    const frame = requestAnimationFrame(() => setFeedback(streak.record > previous.record && streak.current === streak.record ? 'record' : 'advance'))
    return () => cancelAnimationFrame(frame)
  }, [key, streak, reduced])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(undefined), 1100)
    return () => window.clearTimeout(timer)
  }, [feedback])
  return reduced ? undefined : feedback
}

/** FLIP keeps the final layout in place while the same members move to their new positions. */
export function useRankingMotion(ref: RefObject<HTMLElement | null>, signature: string) {
  const reduced = useReducedMotion()
  const before = useRef(new Map<string, { x: number; y: number; width: number }>())
  const focused = useRef<HTMLElement | undefined>(undefined)
  useEffect(() => {
    const track = (event: FocusEvent) => {
      const member = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-contributor]') : null
      focused.current = member && ref.current?.contains(member) ? member : undefined
    }
    document.addEventListener('focusin', track)
    return () => document.removeEventListener('focusin', track)
  }, [ref])
  useLayoutEffect(() => {
    const elements = ref.current?.querySelectorAll<HTMLElement>('[data-contributor]') ?? []
    // Moving between the podium and the list changes the React parent and replaces the node.
    // Only a replaced node is restored: a row the user left behind keeps its node and stays unfocused.
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body) {
      const id = focused.current.dataset.contributor
      focused.current = undefined
      const target = Array.from(elements).find(element => element.dataset.contributor === id)
      const group = target?.closest('details')
      if (group) group.open = true
      target?.focus({ preventScroll: true })
    }
    const next = new Map<string, { x: number; y: number; width: number }>()
    const animations: Animation[] = []
    for (const element of elements) {
      const id = element.dataset.contributor!
      const rect = element.getBoundingClientRect()
      // Document coordinates keep scrolling since the previous update out of the animation.
      const box = { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width }
      const old = before.current.get(id)
      next.set(id, box)
      if (!reduced && old?.width && box.width && (Math.abs(old.x - box.x) > 1 || Math.abs(old.y - box.y) > 1)) {
        animations.push(element.animate([
          { transform: `translate(${old.x - box.x}px, ${old.y - box.y}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }))
      }
    }
    before.current = next
    return () => animations.forEach(animation => animation.cancel())
  }, [ref, signature, reduced])
}
