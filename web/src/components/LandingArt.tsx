import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Landing title with the missed day on a paper slip: the word's slot starts empty, then the
 * slip flies in, flips and lands in the sentence. The entrance is plain CSS on elements that
 * keep their identity across re-renders, so typing, data, language and theme never restart it.
 * The resting styles are the final composition, which is what reduced motion shows.
 */
export function MissedDayTitle({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const title = t('landing.title')
  const [, before = '', day = '', after = ''] = /^(.*)<day>(.*)<\/day>(.*)$/s.exec(title) ?? []
  // The slip is an inline-block, which would add a stray space before "?" in the accessible name.
  return (
    <h1 className={className} aria-label={title.replace(/<\/?day>/g, '')}>
      <span className="language-text">{before}</span>
      <span className="whitespace-nowrap">
        <span className="title-day" data-testid="title-day">
          <span className="title-day-fly">
            <span className="title-day-slip"><span className="language-text">{day}</span></span>
          </span>
        </span>
        <span className="language-text">{after}</span>
      </span>
    </h1>
  )
}

const DRAG_MAX = 8
const PRESS_MIN_MS = 180
const clamp = (value: number) => Math.max(-DRAG_MAX, Math.min(DRAG_MAX, value * 0.45))

/**
 * A decorative icon tile that behaves like a sticker: the corner peels on hover, it squeezes
 * when pressed, and a mouse or pen can tug it a few pixels before it springs back.
 * Touch only gets the press reaction, so scrolling the page is never captured.
 */
export function Sticker({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const pressedAt = useRef(0)
  const releaseTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(releaseTimer.current), [])

  const move = (x: number, y: number) => {
    ref.current?.style.setProperty('--drag-x', `${x}px`)
    ref.current?.style.setProperty('--drag-y', `${y}px`)
  }

  const press = (e: PointerEvent<HTMLSpanElement>) => {
    const el = ref.current
    if (!el || reducedMotion() || (e.pointerType !== 'touch' && e.button !== 0)) return
    window.clearTimeout(releaseTimer.current)
    pressedAt.current = performance.now()
    el.dataset.pressed = ''
    if (e.pointerType === 'touch') return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    el.dataset.dragging = ''
  }

  const follow = (e: PointerEvent<HTMLSpanElement>) => {
    if (drag.current?.id !== e.pointerId) return
    move(clamp(e.clientX - drag.current.x), clamp(e.clientY - drag.current.y))
  }

  const release = () => {
    const el = ref.current
    if (!el || el.dataset.pressed === undefined) return
    drag.current = null
    delete el.dataset.dragging
    move(0, 0)
    // A quick tap still shows the squeeze before it bounces back.
    releaseTimer.current = window.setTimeout(() => { delete el.dataset.pressed }, Math.max(0, PRESS_MIN_MS - (performance.now() - pressedAt.current)))
  }

  return (
    <span
      ref={ref}
      className="sticker"
      aria-hidden="true"
      onPointerDown={press}
      onPointerMove={follow}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onPointerLeave={e => { if (e.pointerType === 'touch') release() }}
    >
      <span className={`sticker-face ${className}`}>{children}</span>
      <span className="sticker-fold" />
    </span>
  )
}
