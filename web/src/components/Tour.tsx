import { CalendarClock, History, PartyPopper, Pencil, Sparkles, Sun, Users, X, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from './ui'

type Step = { id: string; icon: LucideIcon; target?: string }

/** Targets are `data-tour` attributes. A step whose target is not on screen is skipped,
 *  so "write" only appears when the viewer can actually open the editor right now. */
const STEPS: Step[] = [
  { id: 'welcome', icon: Sparkles },
  { id: 'today', icon: Sun, target: 'nav-today' },
  { id: 'yesterday', icon: History, target: 'nav-yesterday' },
  { id: 'upcoming', icon: CalendarClock, target: 'nav-upcoming' },
  { id: 'class', icon: Users, target: 'nav-class' },
  { id: 'write', icon: Pencil, target: 'write' },
  { id: 'done', icon: PartyPopper, target: 'profile' },
]

type Box = { top: number; left: number; width: number; height: number }
type Layout = { spot: Box | null; vw: number; vh: number; cardH: number }

const MARGIN = 12
const GAP = 14
const SPOT_PAD = 6

function findTarget(name?: string): HTMLElement | null {
  if (!name) return null
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

const available = () => STEPS.filter((s) => !s.target || s.id === 'done' || findTarget(s.target))

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)))

function placeCard(spot: Box | null, w: number, h: number, vw: number, vh: number) {
  if (!spot) return { left: (vw - w) / 2, top: clamp((vh - h) / 2, MARGIN, vh - h - MARGIN) }
  const right = spot.left + spot.width
  const bottom = spot.top + spot.height
  // Sidebar items: beside them, so the next items stay visible.
  if (spot.left < vw / 3 && spot.width < vw / 2 && right + GAP + w + MARGIN <= vw) {
    return { left: right + GAP, top: clamp(spot.top + spot.height / 2 - h / 2, MARGIN, vh - h - MARGIN) }
  }
  const left = clamp(spot.left + spot.width / 2 - w / 2, MARGIN, vw - w - MARGIN)
  if (bottom + GAP + h + MARGIN <= vh) return { left, top: bottom + GAP }
  if (spot.top - GAP - h >= MARGIN) return { left, top: spot.top - GAP - h }
  return { left, top: spot.top > vh / 2 ? MARGIN : vh - h - MARGIN }
}

const sameLayout = (a: Layout, b: Layout) => JSON.stringify(a) === JSON.stringify(b)

export function Tour({ demo, onClose }: { demo: boolean; onClose: (finished: boolean) => void }) {
  const { t } = useTranslation()
  const uid = useId()
  const [steps, setSteps] = useState(available)
  const [index, setIndex] = useState(0)
  const step = steps[Math.min(index, steps.length - 1)]
  const cardRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout>({ spot: null, vw: window.innerWidth, vh: window.innerHeight, cardH: 0 })

  // Follow the target through scroll, resize, page changes and late renders: measure every frame.
  useEffect(() => {
    let frame = 0
    const measure = () => {
      const el = findTarget(step.target)
      const r = el?.getBoundingClientRect()
      const next: Layout = {
        spot: r ? { top: Math.round(r.top - SPOT_PAD), left: Math.round(r.left - SPOT_PAD), width: Math.round(r.width + SPOT_PAD * 2), height: Math.round(r.height + SPOT_PAD * 2) } : null,
        vw: window.innerWidth,
        vh: window.innerHeight,
        cardH: cardRef.current?.offsetHeight ?? 0,
      }
      setLayout((prev) => (sameLayout(prev, next) ? prev : next))
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [step.target])

  useEffect(() => {
    const el = findTarget(step.target)
    if (!el) return
    const r = el.getBoundingClientRect()
    // Leave room for the sticky header and the mobile tab bar.
    if (r.top < 72 || r.bottom > window.innerHeight - 88) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [step.target])

  const returnFocus = useRef<Element | null>(null)
  useEffect(() => {
    returnFocus.current = document.activeElement
    return () => {
      const el = returnFocus.current
      // Started from the profile menu: that menu item is gone, so go back to the menu button.
      if (el instanceof HTMLElement && el.isConnected && el !== document.body) el.focus()
      else findTarget('profile')?.focus()
    }
  }, [])
  // Each step moves focus to the dialog, so screen readers read its title and text.
  // The card stays hidden until measured, and hidden elements cannot take focus.
  const shown = layout.cardH > 0
  useLayoutEffect(() => {
    if (shown) cardRef.current?.focus()
  }, [step.id, shown])

  const go = useCallback(
    (delta: number) => {
      const fresh = available()
      const at = Math.max(0, fresh.findIndex((s) => s.id === step.id))
      const next = at + delta
      if (next >= fresh.length) return onClose(true)
      setSteps(fresh)
      setIndex(Math.max(0, next))
    },
    [step.id, onClose],
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose(false)
    } else if (e.key === 'ArrowRight') {
      go(1)
    } else if (e.key === 'ArrowLeft') {
      go(-1)
    } else if (e.key === 'Tab') {
      const focusables = [...(cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const width = Math.min(352, layout.vw - MARGIN * 2)
  const pos = placeCard(layout.spot, width, layout.cardH, layout.vw, layout.vh)
  const spot = layout.spot ?? { top: layout.vh / 2, left: layout.vw / 2, width: 0, height: 0 }
  const position = steps.findIndex((s) => s.id === step.id) + 1
  const isFirst = position === 1
  const isLast = position === steps.length
  const Icon = step.icon

  return createPortal(
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      <div className="tour-spot" style={{ ...spot, borderRadius: layout.spot ? 14 : 0 }} data-target={layout.spot ? '' : undefined} aria-hidden />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-body`}
        tabIndex={-1}
        className="tour-card absolute rounded-2xl border border-line bg-surface p-4 shadow-2xl focus:outline-none"
        style={{ width, top: pos.top, left: pos.left, visibility: layout.cardH ? 'visible' : 'hidden' }}
      >
        <div key={step.id} className="tour-content">
          <div className="flex items-start gap-3">
            <span className="tour-icon flex size-10 shrink-0 items-center justify-center rounded-xl bg-bordeaux-soft text-bordeaux" aria-hidden>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                <span className="language-text">{t('tour.label')}</span> · <span aria-hidden>{position}/{steps.length}</span>
                <span className="sr-only"><span className="language-text">{t('tour.progress', { n: position, total: steps.length })}</span></span>
              </p>
              <h2 id={`${uid}-title`} className="mt-0.5 text-lg font-extrabold leading-snug"><span className="language-text">{t(`tour.${step.id}_title`)}</span></h2>
            </div>
            <button onClick={() => onClose(isLast)} className="-mr-1.5 -mt-1 rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={t('tour.close')}>
              <X className="size-4" />
            </button>
          </div>
          <p id={`${uid}-body`} className="mt-2 text-[15px] leading-relaxed text-ink/80">
            <span className="language-text">{t(`tour.${step.id}_body`)}</span>
            {step.id === 'welcome' && demo && <span className="mt-1 block text-sm text-muted"><span className="language-text">{t('tour.welcome_demo')}</span></span>}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 [&_button]:whitespace-nowrap">
          <div className="mr-auto flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${i + 1 === position ? 'w-5 bg-bordeaux' : i + 1 < position ? 'w-1.5 bg-bordeaux/50' : 'w-1.5 bg-ink/15'}`} />
            ))}
          </div>
          {isFirst ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => onClose(false)}><span className="language-text">{t('tour.skip')}</span></Button>
              <Button size="sm" onClick={() => go(1)}><span className="language-text">{t('tour.start')}</span></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => go(-1)}><span className="language-text">{t('tour.back')}</span></Button>
              <Button size="sm" onClick={() => go(1)}><span className="language-text">{isLast ? t('tour.finish') : t('tour.next')}</span></Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
