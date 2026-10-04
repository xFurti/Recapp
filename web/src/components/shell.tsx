import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Clock, Delete, GraduationCap, KeyRound, LogOut, Moon, School, SunMedium, X } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { api } from '../api'
import logo from '../assets/marconi-logo.png'
import page1 from '../assets/recapp-page-1.png'
import page2 from '../assets/recapp-page-2.png'
import page3 from '../assets/recapp-page-3.png'
import page4 from '../assets/recapp-page-4.png'
import page5 from '../assets/recapp-page-5.png'
import page6 from '../assets/recapp-page-6.png'
import recappWord from '../assets/recapp-wordmark.png'
import { setLanguage } from '../i18n'
import { addDays, getSimulatedNow, setSimulatedNow, todayIso } from '../lib/clock'
import { locale } from '../lib/format'
import type { ClassInfo } from '../types'
import { animateTheme, getTheme, type ThemeChoice } from '../lib/theme'
import { takeCelebrate } from '../lib/celebrate'
import { flushPendingWork } from '../lib/pendingWork'
import { markTourSeen, tourSeen } from '../lib/tour'
import { NavIcon, useNavIconMotion } from './NavIcon'
import { ConfettiBurst } from './Confetti'
import { ClassNavigation } from './ClassNavigation'
import { Tour } from './Tour'
import { UpdateNotice } from './UpdateNotice'
import { Avatar, Button, Field, inputClass, Modal } from './ui'

const SCHOOL_SITE = 'https://www.marconiverona.edu.it/'

/** School mark. Same image and size in both themes, with no plate behind it. */
export function Logo({ className = 'h-9' }: { className?: string }) {
  const { t } = useTranslation()
  const label = t('shell.school_site')
  return (
    <a href={SCHOOL_SITE} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="school-logo inline-flex shrink-0 items-center justify-center">
      <img src={logo} alt="" className={`w-auto ${className}`} />
    </a>
  )
}

/** One full flip of all pages; the keyframes in index.css are written as fractions of it. */
export const RECAPP_MARK_MS = 560

/**
 * The Recapp icon as one layer per page (cut by scripts/split_recapp_icon.py), front page first.
 * `spine` is each page's left edge as a share of the icon width: the page turns around it.
 */
const PAGES = [page1, page2, page3, page4, page5, page6].map((src, i) => ({ src, spine: [0, 14, 27.6, 41.3, 56.2, 72.8][i] }))

/** The Recapp mark; `playing` flips its pages from the last to the first, like thumbing through a notebook. */
function RecappMark({ playing = false, className }: { playing?: boolean; className: string }) {
  return (
    <span className={`nav-icon recapp-mark ${className}`} data-motion="logo" data-playing={playing || undefined} style={{ '--nav-icon-ms': `${RECAPP_MARK_MS}ms` } as CSSProperties}>
      {[...PAGES].reverse().map(({ src, spine }, turn) => (
        <img key={src} src={src} alt="" style={{ '--turn': turn, '--spine': `${spine}%` } as CSSProperties} />
      ))}
    </span>
  )
}

export function Wordmark({ size = 'md', playing }: { size?: 'sm' | 'md' | 'lg'; playing?: boolean }) {
  const heights = { sm: 'h-7', md: 'h-8', lg: 'h-11' }
  return (
    <span className={`inline-flex items-center gap-2 ${heights[size]}`}>
      <RecappMark playing={playing} className="h-full" />
      <img src={recappWord} alt="Recapp" className="h-[70%] w-auto dark:invert" />
    </span>
  )
}

export function ThemeToggle() {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<ThemeChoice>(getTheme)
  const motion = useNavIconMotion()
  const Icon = choice === 'dark' ? Moon : SunMedium
  const next = () => {
    const value: ThemeChoice = choice === 'dark' ? 'light' : 'dark'
    setChoice(value)
    animateTheme(value)
  }
  const label = t('theme.label', { mode: t(`theme.${choice}`) })
  return (
    <button onClick={next} {...motion.triggers} className="flex size-8 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink" title={label} aria-label={label}>
      <NavIcon icon={Icon} motion={choice === 'dark' ? 'moon' : 'theme'} playing={motion.playing} className="size-4" />
    </button>
  )
}

/** Five-point star, point up. */
function starPoints(cx: number, cy: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const peak = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const valley = peak + Math.PI / 5
    pts.push(`${(cx + r * Math.cos(peak)).toFixed(2)},${(cy + r * Math.sin(peak)).toFixed(2)}`)
    pts.push(`${(cx + r * 0.38 * Math.cos(valley)).toFixed(2)},${(cy + r * 0.38 * Math.sin(valley)).toFixed(2)}`)
  }
  return pts.join(' ')
}

function ItalyFlag() {
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
      <rect width="10.67" height="32" fill="#009246" />
      <rect x="10.67" width="10.66" height="32" fill="#fff" />
      <rect x="21.33" width="10.67" height="32" fill="#ce2b37" />
    </svg>
  )
}

/** UK on top, USA underneath: the two flags people mean by English, and not a French tricolor. */
function EnglishFlag() {
  const clip = useId().replace(/:/g, '')
  const stripe = 16 / 13
  return (
    <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
      <svg width="32" height="16" viewBox="0 0 60 30">
        <defs>
          <clipPath id={clip}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
        </defs>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clip})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </svg>
      <g transform="translate(0 16)">
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} y={stripe * i} width="32" height={stripe + 0.08} fill={i % 2 ? '#fff' : '#B22234'} />
        ))}
        <rect width="12.8" height={stripe * 7} fill="#3C3B6E" />
        <polygon points={starPoints(6.4, stripe * 3.5, 2.15)} fill="#fff" />
      </g>
    </svg>
  )
}

/** One round button: the current language, as its flag, flips to the other. */
export function LangToggle() {
  const { i18n, t } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'it'
  const next = lang === 'it' ? 'en' : 'it'
  const label = t('common.language_switch', { lang: t(`common.lang_${next}`) })
  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className="lang-btn flex size-8 items-center justify-center overflow-hidden rounded-full"
      title={label}
      aria-label={label}
    >
      <span key={lang} className="lang-swap block size-full">
        {lang === 'it' ? <ItalyFlag /> : <EnglishFlag />}
      </span>
    </button>
  )
}

export function TimeTravel() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const motion = useNavIconMotion()
  const [open, setOpen] = useState(false)
  const sim = getSimulatedNow()
  const [custom, setCustom] = useState(sim ?? `${todayIso()}T18:30`)
  const apply = (value: string | null) => {
    setSimulatedNow(value)
    setOpen(false)
    qc.invalidateQueries()
  }
  const today = todayIso()
  const label = sim
    ? new Intl.DateTimeFormat(locale(i18n.language), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(sim))
    : null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        {...motion.triggers}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ${sim ? 'bg-giallo text-[#1d1b1e]' : 'border border-line bg-surface text-muted hover:text-ink'}`}
        title={t('time.title')}
      >
        <NavIcon icon={Clock} motion="clock" playing={motion.playing} className="size-3.5" />
        {label ? <span className="hidden sm:inline">{t('time.badge', { time: label })}</span> : <span className="sr-only">{t('time.title')}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('time.title')}>
        <p className="mb-4 text-sm text-muted">{t('time.help')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => apply(`${today}T10:00`)}>{t('time.morning')}</Button>
          <Button variant="secondary" onClick={() => apply(`${today}T15:00`)}>{t('time.afternoon')}</Button>
          <Button variant="secondary" onClick={() => apply(`${today}T18:30`)}>{t('time.evening')}</Button>
          <Button variant="secondary" onClick={() => apply(`${addDays(today, 1)}T09:00`)}>{t('time.tomorrow')}</Button>
        </div>
        <div className="mt-4 flex items-end gap-2">
          <Field label={t('time.custom')}>
            <input type="datetime-local" className={inputClass} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </Field>
          <Button onClick={() => apply(custom)}>{t('time.apply')}</Button>
        </div>
        <Button variant="ghost" className="mt-4 w-full" onClick={() => apply(null)}>
          {t('time.real')}
        </Button>
      </Modal>
    </>
  )
}

function SimBar() {
  const { t, i18n } = useTranslation()
  const [sim, setSim] = useState(getSimulatedNow)
  useEffect(() => {
    const sync = () => setSim(getSimulatedNow())
    window.addEventListener('ieri-time', sync)
    return () => window.removeEventListener('ieri-time', sync)
  }, [])
  if (!sim) return null
  const label = new Intl.DateTimeFormat(locale(i18n.language), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(sim))
  return <p className="bg-giallo px-4 py-1 text-center text-xs font-bold text-[#1d1b1e] sm:hidden">{t('time.badge', { time: label })}</p>
}

function ProfileMenu({ info, onTour }: { info: ClassInfo; onTour: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const [pinOpen, setPinOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const handoff = useRef(false)
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finishClose = useCallback(() => {
    setPhase('closed')
    if (!handoff.current) btnRef.current?.focus()
    handoff.current = false
  }, [])
  const close = useCallback(() => {
    setPhase((current) => (current === 'open' ? 'closing' : current))
  }, [])
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const location = useLocation()
  useEffect(() => {
    if (phaseRef.current !== 'closed') finishClose()
  }, [location.pathname, finishClose])
  useEffect(() => {
    if (phase === 'closed') return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [phase, close])
  useLayoutEffect(() => {
    if (phase === 'closed') return
    const place = () => {
      const anchor = btnRef.current?.getBoundingClientRect()
      if (!anchor) return
      setBox({ top: anchor.bottom + 8, right: Math.max(8, window.innerWidth - anchor.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [phase])
  useEffect(() => {
    if (phase === 'open') panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    if (phase === 'closing' && reduced()) finishClose()
  }, [phase, finishClose])
  const member = info.viewer.member
  const logout = async () => {
    handoff.current = true
    setPhase('closed')
    await api.post('/auth/logout')
    qc.clear()
    navigate(info.viewer.kind === 'owner' ? '/scuola' : '/')
  }
  const openPin = () => {
    handoff.current = true
    setPhase('closed')
    setPinOpen(true)
  }
  const replay = () => {
    handoff.current = true
    setPhase('closed')
    onTour()
  }
  const toggle = () => setPhase((current) => (current === 'open' ? 'closing' : 'open'))
  const row = 'profile-row profile-action flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm'
  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-2 rounded-full p-0.5 hover:bg-ink/5 active:scale-95"
        aria-haspopup="menu"
        aria-expanded={phase !== 'closed'}
        aria-label={t('shell.profile_menu')}
        data-tour="profile"
      >
        {member ? <Avatar nick={member.nick} color={member.color} size="sm" /> : <School className="size-6 text-bordeaux" />}
      </button>
      {phase !== 'closed' && box && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={t('shell.profile_menu')}
          inert={phase === 'closing'}
          data-phase={phase}
          style={{ top: box.top, right: box.right }}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && e.animationName === 'profile-out') finishClose()
          }}
          className="profile-panel fixed z-40 w-[min(18rem,calc(100vw-1rem))] rounded-2xl border border-line bg-surface p-2 shadow-lg"
        >
          <div className="profile-row flex items-start gap-3 px-2 py-2" style={{ '--i': 0 } as CSSProperties}>
            {member ? <Avatar nick={member.nick} color={member.color} /> : <School className="size-10 text-bordeaux" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{member ? member.nick : t('shell.school_view')}</p>
              <p className="truncate text-xs text-muted">
                {member ? `${t(`shell.role_${member.role}`)} · ${info.label}` : info.label}
                {info.is_demo ? ` · ${t('shell.demo')}` : ''}
              </p>
            </div>
            <button type="button" role="menuitem" onClick={close} aria-label={t('common.close')} className="profile-action flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ink/5">
              <X className="size-5" />
            </button>
          </div>
          {member && (
            <button role="menuitem" onClick={openPin} className={row} style={{ '--i': 1 } as CSSProperties}>
              <KeyRound className="size-4" /> {t('shell.change_pin')}
            </button>
          )}
          <button role="menuitem" onClick={replay} className={row} style={{ '--i': 2 } as CSSProperties}>
            <GraduationCap className="size-4" /> {t('tour.replay')}
          </button>
          <div className="profile-row flex items-center justify-between gap-2 px-2 py-2 sm:hidden" style={{ '--i': 3 } as CSSProperties}>
            <ThemeToggle />
            <LangToggle />
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <button role="menuitem" onClick={logout} className={`${row} text-rosa-ink hover:bg-rosa-soft`} style={{ '--i': 4 } as CSSProperties}>
              <LogOut className="size-4" /> {t('common.logout')}
            </button>
          </div>
        </div>,
        document.body,
      )}
      <ChangePinModal open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  )
}

function ChangePinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api.post('/auth/change-pin', { old_pin: oldPin, new_pin: newPin })
      setMsg(t('shell.pin_changed'))
      setOldPin('')
      setNewPin('')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const pinInput = (value: string, set: (v: string) => void) => (
    <input className={`${inputClass} tracking-[0.4em]`} inputMode="numeric" type="password" maxLength={6} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} />
  )
  return (
    <Modal open={open} onClose={onClose} title={t('shell.change_pin')}>
      <div className="space-y-3">
        <Field label={t('shell.old_pin')}>{pinInput(oldPin, setOldPin)}</Field>
        <Field label={t('join.new_pin')}>{pinInput(newPin, setNewPin)}</Field>
        {msg && <p className="text-sm font-medium">{msg}</p>}
        <Button className="w-full" onClick={submit} loading={busy} disabled={oldPin.length !== 6 || newPin.length !== 6}>
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  )
}

export function AppShell({ info, children }: { info: ClassInfo; children: ReactNode }) {
  const { t } = useTranslation()
  const base = `/c/${info.code}`
  const showClock = import.meta.env.DEV || info.is_demo
  const sideMark = useNavIconMotion(RECAPP_MARK_MS)
  const topMark = useNavIconMotion(RECAPP_MARK_MS)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const fetching = useIsFetching()
  const [tourOpen, setTourOpen] = useState(false)
  const [party, setParty] = useState(false)
  const stopParty = useCallback(() => setParty(false), [])
  const autoTried = useRef(false)

  useEffect(() => {
    if (takeCelebrate()) setParty(true)
  }, [location.key])

  // First visit: wait until the page has its data, and never interrupt someone who opened the editor directly.
  useEffect(() => {
    if (autoTried.current || fetching > 0) return
    if (tourSeen(info) || location.pathname.includes('/scrivi/')) {
      autoTried.current = true
      return
    }
    const id = setTimeout(() => {
      autoTried.current = true
      setTourOpen(true)
    }, 400)
    return () => clearTimeout(id)
  }, [fetching, info, location.pathname])

  const startTour = async () => {
    if (location.pathname !== base) {
      // The tour walks through the Today page; unsaved editor changes are saved first, or we stay put.
      try {
        await flushPendingWork()
        navigate(base)
      } catch {
        // Keep the page and its changes; the tour still works on the navigation.
      }
    }
    setTourOpen(true)
  }
  const closeTour = useCallback(() => {
    setTourOpen(false)
    markTourSeen(info, qc)
  }, [info, qc])

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2">
          <Link to={base} {...sideMark.triggers}>
            <Wordmark size="md" playing={sideMark.playing} />
          </Link>
          <Logo className="h-6" />
        </div>
        <ClassNavigation code={info.code} />
        <p className="mt-auto text-xs text-muted">{t('landing.footer')}</p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          {info.viewer.kind === 'owner' && (
            <div className="flex items-center justify-between bg-ink px-4 py-1.5 text-xs font-semibold text-paper">
              <span>{t('shell.school_view')}</span>
              <Link to="/scuola" className="underline">{t('shell.back_school')}</Link>
            </div>
          )}
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
            <Link to={base} className="flex h-7 shrink-0 md:hidden" aria-label="Recapp" {...topMark.triggers}>
              <RecappMark playing={topMark.playing} className="h-7" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">{info.label}</p>
              <p className="hidden truncate text-xs text-muted sm:block">{t('common.app_name')} · {t('common.tagline')}</p>
            </div>
            {showClock && <TimeTravel />}
            <div className="hidden items-center gap-2 sm:flex">
              <ThemeToggle />
              <LangToggle />
            </div>
            <ProfileMenu info={info} onTour={startTour} />
          </div>
          {showClock && <SimBar />}
          <UpdateNotice />
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:pb-12">{children}</main>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <ClassNavigation code={info.code} mobile />
      </div>
      {tourOpen && <Tour demo={info.is_demo} onClose={closeTour} />}
      {party && <ConfettiBurst onDone={stopParty} />}
    </div>
  )
}

export function PinPad({ value, onChange, onSubmit, disabled }: { value: string; onChange: (v: string) => void; onSubmit?: (v: string) => void; disabled?: boolean }) {
  const press = (d: string) => {
    if (disabled || value.length >= 6) return
    const next = value + d
    onChange(next)
    if (next.length === 6) onSubmit?.(next)
  }
  return (
    <div
      className="mx-auto w-full max-w-xs"
      tabIndex={0}
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) press(e.key)
        else if (e.key === 'Backspace') onChange(value.slice(0, -1))
      }}
    >
      <div className="mb-5 flex justify-center gap-3" aria-live="polite" aria-label={`${value.length}/6`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`size-3.5 rounded-full transition ${i < value.length ? 'bg-bordeaux' : 'bg-ink/15'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={disabled} className="h-14 rounded-2xl bg-surface text-xl font-semibold shadow-sm ring-1 ring-line hover:bg-paper active:scale-95">
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} disabled={disabled} className="h-14 rounded-2xl bg-surface text-xl font-semibold shadow-sm ring-1 ring-line hover:bg-paper active:scale-95">
          0
        </button>
        <button type="button" onClick={() => onChange(value.slice(0, -1))} disabled={disabled} className="flex h-14 items-center justify-center rounded-2xl text-muted hover:bg-ink/5" aria-label="Cancella">
          <Delete className="size-6" />
        </button>
      </div>
    </div>
  )
}
