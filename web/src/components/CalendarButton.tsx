import { CalendarCheck, CalendarPlus, Download, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { calendarEvent, downloadCalendar, googleCalendarUrl } from '../lib/calendar'
import { useClass } from '../queries'
import type { Item, Subject } from '../types'
import { AnchoredMenu, Toast } from './ui'

function Choice({ icon: Icon, tile, title, hint, index }: { icon: ComponentType<{ className?: string }>; tile: string; title: string; hint: string; index: number }) {
  return (
    <span className="menu-row flex min-w-0 items-center gap-3" style={{ '--i': index } as CSSProperties}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tile}`} aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="language-text block font-semibold">{title}</span>
        <span className="language-text block text-xs font-medium text-muted">{hint}</span>
      </span>
    </span>
  )
}

export function CalendarButton({ item, subjects, compact }: { item: Item; subjects: Subject[]; compact?: boolean }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const choices = useRef<(HTMLElement | null)[]>([])
  const [initialFocus, setInitialFocus] = useState(0)
  const menuId = useId()
  const close = useCallback(() => {
    if (choices.current.includes(document.activeElement as HTMLElement)) trigger.current?.focus()
    setOpen(false)
  }, [])
  const done = useCallback(() => {
    setAdded(true)
    close()
  }, [close])
  const clearToast = useCallback(() => setToast(null), [])
  useEffect(() => {
    if (!added) return
    const id = window.setTimeout(() => setAdded(false), 1800)
    return () => window.clearTimeout(id)
  }, [added])
  // Every row renders a trigger; only build the event (and its URLs) once a menu is actually open.
  const event = useMemo(
    () => (open ? calendarEvent(item, info, subjects, t, i18n.language, window.location.origin) : null),
    [open, item, info, subjects, t, i18n.language],
  )
  const onMenuKey = (e: KeyboardEvent) => {
    const items = choices.current.filter(Boolean)
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: number
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') next = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else if (e.key === 'Tab') {
      close()
      return
    } else return
    e.preventDefault()
    items[next]?.focus()
  }
  const optionClass = 'flex min-h-11 w-full items-center rounded-xl px-2 py-1.5 text-left text-sm text-ink transition-colors hover:bg-ink/5 focus-visible:bg-ink/5'
  const Icon = added ? CalendarCheck : CalendarPlus
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t('calendar.add')}
        title={t('calendar.add')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={e => {
          setAnchor(e.currentTarget)
          setInitialFocus(0)
          setOpen(value => !value)
        }}
        onKeyDown={e => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          setAnchor(e.currentTarget)
          setInitialFocus(e.key === 'ArrowUp' ? 1 : 0)
          setOpen(true)
        }}
        className={`calendar-trigger inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 transition-colors aria-expanded:bg-azzurro-soft aria-expanded:text-azzurro-ink ${
          added ? 'text-verde-ink' : 'text-muted hover:text-ink'
        } ${compact ? 'min-h-11 w-11 self-center rounded-xl hover:bg-ink/5' : '-my-1 min-h-8 rounded-full px-2 text-xs font-semibold hover:bg-ink/5'}`}
      >
        <Icon key={added ? 'added' : 'add'} className={`size-4 shrink-0 ${added ? 'calendar-added' : ''}`} aria-hidden />
        {!compact && <span className="language-text text-left">{t('calendar.add')}</span>}
      </button>
      <AnchoredMenu open={open} anchorEl={anchor} onClose={close} id={menuId} label={t('calendar.add')} initialFocus={initialFocus}>
        {event && (
          <>
            <a
              ref={el => { choices.current[0] = el }}
              role="menuitem"
              tabIndex={-1}
              href={googleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={done}
              onKeyDown={onMenuKey}
              className={optionClass}
            >
              <Choice icon={ExternalLink} tile="bg-azzurro-soft text-azzurro-ink" title={t('calendar.google')} hint={t('calendar.google_hint')} index={0} />
            </a>
            <button
              ref={el => { choices.current[1] = el }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                downloadCalendar(event)
                setToast(t('calendar.downloaded'))
                done()
              }}
              onKeyDown={onMenuKey}
              className={optionClass}
            >
              <Choice icon={Download} tile="bg-ink/5 text-ink" title={t('calendar.apple')} hint={t('calendar.apple_hint')} index={1} />
            </button>
          </>
        )}
      </AnchoredMenu>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}
