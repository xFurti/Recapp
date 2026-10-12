import { CalendarPlus, Download, ExternalLink } from 'lucide-react'
import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { calendarEvent, downloadCalendar, googleCalendarUrl } from '../lib/calendar'
import { useClass } from '../queries'
import type { Item, Subject } from '../types'
import { AnchoredMenu } from './ui'

export function CalendarButton({ item, subjects, compact }: { item: Item; subjects: Subject[]; compact?: boolean }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const choices = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([])
  const [initialFocus, setInitialFocus] = useState(0)
  const menuId = useId()
  const close = useCallback(() => {
    if (choices.current.includes(document.activeElement as HTMLButtonElement)) trigger.current?.focus()
    setOpen(false)
  }, [])
  const event = calendarEvent(item, info, subjects, t, i18n.language, window.location.origin)
  const onMenuKey = (e: KeyboardEvent) => {
    const index = choices.current.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') next = (index + (e.key === 'ArrowDown' ? 1 : -1) + 2) % 2
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 1
    else if (e.key === 'Tab') {
      close()
      return
    } else return
    e.preventDefault()
    choices.current[next]?.focus()
  }
  const optionClass = 'flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink transition-colors hover:bg-ink/5'
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
        className={`inline-flex min-h-11 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-xl text-muted hover:bg-ink/5 hover:text-ink ${compact ? 'w-11 self-center' : 'px-2 text-xs font-semibold'}`}
      >
        <CalendarPlus className="size-4 shrink-0" aria-hidden />
        {!compact && <span className="language-text text-left">{t('calendar.add')}</span>}
      </button>
      <AnchoredMenu open={open} anchorEl={anchor} onClose={close} id={menuId} label={t('calendar.add')} initialFocus={initialFocus}>
        <a
          ref={el => { choices.current[0] = el }}
          role="menuitem"
          tabIndex={-1}
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          onKeyDown={onMenuKey}
          className={optionClass}
        >
          <ExternalLink className="size-4" aria-hidden />
          <span className="language-text">{t('calendar.google')}</span>
        </a>
        <button
          ref={el => { choices.current[1] = el }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => {
            downloadCalendar(event)
            close()
          }}
          onKeyDown={onMenuKey}
          className={optionClass}
        >
          <Download className="size-4" aria-hidden />
          <span className="language-text">{t('calendar.apple')}</span>
        </button>
      </AnchoredMenu>
    </>
  )
}
