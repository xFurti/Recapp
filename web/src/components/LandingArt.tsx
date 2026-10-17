import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The day that goes missing, then flips back into place. */
const MISSING = 2
const TILT = ['-3deg', '2deg', '0deg', '-1.5deg', '2.5deg']
const ACCENT = ['azzurro', 'verde', 'bordeaux', 'giallo', 'viola'].map(color => `var(--color-${color})`)

function Day({ letter }: { letter: string }) {
  return (
    <>
      <b>{letter}</b>
      <i />
      <i />
    </>
  )
}

/**
 * Decorative week on the landing page: one day is missing and returns to its slot.
 * The entrance is plain CSS, so it plays once per mount and re-renders (typing, data,
 * language, theme) never restart it. The resting styles are the final composition,
 * which is what reduced motion shows.
 */
export function MissedDayWeek({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const days = t('landing.week_days').split(' ')
  return (
    <div className={`missed-week ${className}`} aria-hidden="true" data-testid="missed-week">
      {days.map((letter, index) =>
        index === MISSING ? (
          <span key={index} className="missed-week-slot">
            <span className="missed-week-found">
              <span className="missed-week-flip">
                <span className="missed-week-tile missed-week-tile--front"><Day letter={letter} /></span>
                <span className="missed-week-tile missed-week-tile--back" />
              </span>
            </span>
          </span>
        ) : (
          <span key={index} className="missed-week-tile" style={{ '--tilt': TILT[index], '--accent': ACCENT[index] } as CSSProperties}>
            <Day letter={letter} />
          </span>
        ),
      )}
      <span className="missed-week-line" />
      {days.map((_, index) => (
        <span key={index} className={`missed-week-dot${index === MISSING ? ' missed-week-dot--found' : ''}`} style={{ gridColumn: index + 1, '--accent': ACCENT[index] } as CSSProperties} />
      ))}
    </div>
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
