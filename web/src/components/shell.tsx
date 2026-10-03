import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Clock, Delete, GraduationCap, History, KeyRound, LogOut, Moon, School, Sun, SunMedium, Users, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { api } from '../api'
import logo from '../assets/marconi-logo.png'
import recappIcon from '../assets/recapp-icon.png'
import recappWord from '../assets/recapp-wordmark.png'
import { setLanguage } from '../i18n'
import { addDays, getSimulatedNow, setSimulatedNow, todayIso } from '../lib/clock'
import { locale } from '../lib/format'
import type { ClassInfo } from '../types'
import { getTheme, setTheme, type ThemeChoice } from '../lib/theme'
import { flushPendingWork } from '../lib/pendingWork'
import { markTourSeen, tourSeen } from '../lib/tour'
import { NAV_ICON_MS, NavIcon, useNavIconMotion, type NavMotion } from './NavIcon'
import { Tour } from './Tour'
import { UpdateNotice } from './UpdateNotice'
import { Avatar, Button, Field, inputClass, Modal, useDismiss } from './ui'

export function Logo({ className = 'h-9' }: { className?: string }) {
  return <img src={logo} alt="ITI G. Marconi Verona" className={`w-auto dark:rounded-md dark:bg-white dark:p-0.5 ${className}`} />
}

/** The Recapp mark; `playing` runs the same micro-animation cycle as the nav icons (see useNavIconMotion). */
function RecappMark({ playing = false, className }: { playing?: boolean; className: string }) {
  return (
    <span className="nav-icon h-full" data-motion="logo" data-playing={playing || undefined} style={{ '--nav-icon-ms': `${NAV_ICON_MS}ms` } as CSSProperties}>
      <img src={recappIcon} alt="" className={className} />
    </span>
  )
}

export function Wordmark({ size = 'md', playing }: { size?: 'sm' | 'md' | 'lg'; playing?: boolean }) {
  const heights = { sm: 'h-7', md: 'h-8', lg: 'h-11' }
  return (
    <span className={`inline-flex items-center gap-2 ${heights[size]}`}>
      <RecappMark playing={playing} className="h-full w-auto" />
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
    setTheme(value)
    setChoice(value)
  }
  const label = t('theme.label', { mode: t(`theme.${choice}`) })
  return (
    <button onClick={next} {...motion.triggers} className="flex size-8 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink" title={label} aria-label={label}>
      <NavIcon icon={Icon} motion={choice === 'dark' ? 'moon' : 'theme'} playing={motion.playing} className="size-4" />
    </button>
  )
}

export function LangToggle() {
  const { i18n, t } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'it'
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-xs font-bold" role="group" aria-label={t('common.language')}>
      {(['it', 'en'] as const).map((l) => (
        <LangButton key={l} code={l} active={lang === l} />
      ))}
    </div>
  )
}

function LangButton({ code, active }: { code: 'it' | 'en'; active: boolean }) {
  const motion = useNavIconMotion()
  return (
    <button
      onClick={() => setLanguage(code)}
      {...motion.triggers}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 uppercase transition ${active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}
    >
      <span className="nav-icon" data-motion="lang" data-playing={motion.playing || undefined} style={{ '--nav-icon-ms': `${NAV_ICON_MS}ms` } as CSSProperties}>
        {code}
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
  const [open, setOpen] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const location = useLocation()
  useEffect(() => close(), [location.pathname, close])
  const member = info.viewer.member
  const logout = async () => {
    await api.post('/auth/logout')
    qc.clear()
    navigate(info.viewer.kind === 'owner' ? '/scuola' : '/')
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 hover:bg-ink/5" aria-haspopup="menu" aria-expanded={open} aria-label={t('shell.profile_menu')} data-tour="profile">
        {member ? <Avatar nick={member.nick} color={member.color} size="sm" /> : <School className="size-6 text-bordeaux" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-line bg-surface p-2 shadow-lg" role="menu">
          {member && (
            <div className="px-3 py-2">
              <p className="font-semibold">{member.nick}</p>
              <p className="text-xs text-muted">{t(`shell.role_${member.role}`)} · {info.label}</p>
            </div>
          )}
          {member && (
            <button role="menuitem" onClick={() => { setOpen(false); setPinOpen(true) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5">
              <KeyRound className="size-4" /> {t('shell.change_pin')}
            </button>
          )}
          <button role="menuitem" onClick={() => { setOpen(false); onTour() }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5">
            <GraduationCap className="size-4" /> {t('tour.replay')}
          </button>
          <div className="flex items-center justify-between gap-2 px-2 py-2 sm:hidden">
            <ThemeToggle />
            <LangToggle />
          </div>
          <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rosa-ink hover:bg-rosa-soft">
            <LogOut className="size-4" /> {t('common.logout')}
          </button>
        </div>
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

type NavEntry = { to: string; icon: LucideIcon; motion: NavMotion; key: string; end?: boolean }

const NAV: NavEntry[] = [
  { to: '', icon: Sun, motion: 'today', key: 'nav.today', end: true },
  { to: 'ieri', icon: History, motion: 'yesterday', key: 'nav.yesterday' },
  { to: 'in-arrivo', icon: CalendarClock, motion: 'upcoming', key: 'nav.upcoming' },
  { to: 'classe', icon: Users, motion: 'class', key: 'nav.class' },
]

function NavItem({ entry, base, className, iconClass }: { entry: NavEntry; base: string; className: (isActive: boolean) => string; iconClass: string }) {
  const { t } = useTranslation()
  const { playing, triggers } = useNavIconMotion()
  return (
    <NavLink to={entry.to ? `${base}/${entry.to}` : base} end={entry.end} className={({ isActive }) => className(isActive)} data-tour={`nav-${entry.motion}`} {...triggers}>
      <NavIcon icon={entry.icon} motion={entry.motion} playing={playing} className={iconClass} />
      {t(entry.key)}
    </NavLink>
  )
}

export function AppShell({ info, children }: { info: ClassInfo; children: ReactNode }) {
  const { t } = useTranslation()
  const base = `/c/${info.code}`
  const showClock = import.meta.env.DEV || info.is_demo
  const sideMark = useNavIconMotion()
  const topMark = useNavIconMotion()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const fetching = useIsFetching()
  const [tourOpen, setTourOpen] = useState(false)
  const autoTried = useRef(false)

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
        <Link to={base} className="mb-6 flex items-center gap-2" {...sideMark.triggers}>
          <Wordmark size="md" playing={sideMark.playing} />
          <Logo className="h-6" />
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavItem
              key={n.key}
              entry={n}
              base={base}
              iconClass="size-5"
              className={(isActive) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${isActive ? 'bg-bordeaux-soft text-bordeaux' : 'text-muted hover:bg-ink/5 hover:text-ink'}`
              }
            />
          ))}
        </nav>
        <p className="mt-auto text-xs text-muted">{t('landing.footer')}</p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          {info.viewer.kind === 'owner' && (
            <div className="flex items-center justify-between bg-ink px-4 py-1.5 text-xs font-semibold text-paper">
              <span>{t('shell.school_view')}</span>
              <Link to="/scuola" className="underline">{t('shell.back_school')}</Link>
            </div>
          )}
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
            <Link to={base} className="flex h-7 shrink-0 md:hidden" aria-label="Recapp" {...topMark.triggers}>
              <RecappMark playing={topMark.playing} className="h-7 w-auto" />
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

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map((n) => (
            <NavItem
              key={n.key}
              entry={n}
              base={base}
              iconClass="size-6"
              className={(isActive) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${isActive ? 'text-bordeaux' : 'text-muted'}`}
            />
          ))}
        </div>
      </nav>
      {tourOpen && <Tour demo={info.is_demo} onClose={closeTour} />}
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
