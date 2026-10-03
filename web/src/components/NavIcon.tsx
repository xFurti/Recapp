import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react'

export type NavMotion = 'today' | 'yesterday' | 'upcoming' | 'class'

/** One full cycle; the keyframes in index.css are written as fractions of it. */
export const NAV_ICON_MS = 360

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Plays one cycle per interaction: hover (mouse/pen), keyboard focus, or a tap.
 * Triggers that arrive while a cycle is running are ignored, so hover + focus + click never restart it.
 */
export function useNavIconMotion() {
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const play = useCallback(() => {
    if (timer.current !== undefined || reducedMotion()) return
    setPlaying(true)
    timer.current = window.setTimeout(() => {
      timer.current = undefined
      setPlaying(false)
    }, NAV_ICON_MS)
  }, [])

  const triggers = {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType !== 'touch') play()
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'touch') play()
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(':focus-visible')) play()
    },
  }
  return { playing, triggers }
}

export function NavIcon({ icon: Icon, motion, playing, className }: { icon: LucideIcon; motion: NavMotion; playing: boolean; className?: string }) {
  return (
    <span className="nav-icon" data-motion={motion} data-playing={playing || undefined} style={{ '--nav-icon-ms': `${NAV_ICON_MS}ms` } as CSSProperties} aria-hidden>
      <Icon className={className} />
    </span>
  )
}
