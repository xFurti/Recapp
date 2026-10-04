import { ArrowRight, CalendarCheck, FlaskConical, Info } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { longDay, subjectColor, subjectName } from '../lib/format'
import { validTime, weekdayName, type Slot, type TimetableModel } from '../lib/timetable'
import type { HourSlot, Subject, TimetableData } from '../types'
import { Badge, Button, Modal } from './ui'

type Block = { kind: 'lesson'; slot: Slot; hours: HourSlot[] } | { kind: 'free'; hours: HourSlot[] }

/** Consecutive hours of the same subject and room become one block; gaps between lessons are free hours. */
function dayBlocks(data: TimetableData, weekday: number): Block[] {
  const rows = [...data.hours].sort((a, b) => a.hour - b.hour)
  const at = (h: number) => data.slots.find((s) => s.weekday === weekday && s.hour === h)
  const used = rows.filter((r) => at(r.hour))
  if (!used.length) return []
  const first = used[0].hour
  const last = used[used.length - 1].hour
  const blocks: Block[] = []
  for (const row of rows.filter((r) => r.hour >= first && r.hour <= last)) {
    const slot = at(row.hour)
    const prev = blocks[blocks.length - 1]
    if (slot && prev?.kind === 'lesson' && prev.slot.subject_code === slot.subject_code && prev.slot.room === slot.room) prev.hours.push(row)
    else if (!slot && prev?.kind === 'free') prev.hours.push(row)
    else blocks.push(slot ? { kind: 'lesson', slot, hours: [row] } : { kind: 'free', hours: [row] })
  }
  return blocks
}

function useHoursLabel() {
  const { t } = useTranslation()
  return (hours: HourSlot[]) => {
    const from = hours[0].hour
    const to = hours[hours.length - 1].hour
    return from === to ? t('class.tt_hour_short', { hour: from }) : t('class.tt_hours_short', { from, to })
  }
}

function RoomLine({ slot, hours }: { slot: Slot; hours: HourSlot[] }) {
  const { t } = useTranslation()
  const start = hours[0].start
  const end = hours[hours.length - 1].end
  const room = slot.room.trim()
  const roomText = !room ? t('class.tt_room_missing') : /^palestra$/i.test(room) ? room : t('class.tt_room_value', { room })
  const time = validTime(start) ? (validTime(end) ? `${start}–${end}` : start) : t('class.tt_time_missing')
  return (
    <p className="text-sm text-muted">
      {time} · <span className={room ? 'font-semibold text-ink' : 'italic'}>{roomText}</span>
    </p>
  )
}

function LabBadge() {
  const { t } = useTranslation()
  return (
    <Badge className="bg-verde-soft text-verde-ink">
      <FlaskConical className="size-3.5" aria-hidden /> <span className="language-text">{t('class.tt_lab')}</span>
    </Badge>
  )
}

function NowBadge() {
  const { t } = useTranslation()
  return <Badge className="bg-bordeaux text-white"><span className="language-text">{t('class.tt_now')}</span></Badge>
}

export function DayView({ data, model, demo }: { data: TimetableData; model: TimetableModel; demo: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const hoursLabel = useHoursLabel()
  const [picked, setPicked] = useState<number | null>(null)
  const day = picked ?? model.defaultDay
  const blocks = dayBlocks(data, day)
  const idx = model.days.indexOf(day)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const move = (delta: number) => {
    const next = model.days[idx + delta]
    if (next !== undefined) setPicked(next)
  }
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(e.clientY - start.y)) move(dx < 0 ? 1 : -1)
  }

  return (
    <div>
      <div className="grid gap-1 rounded-2xl bg-ink/5 p-1" style={{ gridTemplateColumns: `repeat(${model.days.length}, minmax(0, 1fr))` }} role="group" aria-label={t('class.tt_days')}>
        {model.days.map((d) => (
          <button
            key={d}
            onClick={() => setPicked(d)}
            aria-pressed={d === day}
            aria-label={`${weekdayName(d, lang)}${d === model.todayWd ? `, ${t('class.tt_today')}` : ''}`}
            className={`relative flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-sm font-bold transition ${d === day ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {weekdayName(d, lang, 'short')}
            {d === model.todayWd && <span className="absolute bottom-1 size-1.5 rounded-full bg-bordeaux" aria-hidden />}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-extrabold">{weekdayName(day, lang)}</h2>
        {day === model.todayWd && <Badge className="bg-bordeaux-soft text-bordeaux"><span className="language-text">{t('class.tt_today')}</span></Badge>}
        {day === model.nextWd && <Badge className="bg-azzurro-soft text-azzurro-ink"><span className="language-text">{t('class.tt_next_day')}</span></Badge>}
        {model.todayWd !== null && day !== model.todayWd && (
          <Button size="sm" variant="secondary" className="ml-auto min-h-11" onClick={() => setPicked(model.todayWd)}>
            <CalendarCheck className="size-4" /> <span className="language-text">{t('class.tt_go_today')}</span>
          </Button>
        )}
      </div>
      {day === model.nextWd && model.nextDay && (
        <p className="mt-2 flex gap-2 rounded-xl border border-azzurro/20 bg-azzurro-soft px-3 py-2 text-sm text-azzurro-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="language-text">{t(demo ? 'class.tt_no_school_today_demo' : 'class.tt_no_school_today', { day: longDay(model.nextDay, lang) })}</span>
        </p>
      )}

      {blocks.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted"><span className="language-text">{t('class.tt_day_empty', { day: weekdayName(day, lang) })}</span></p>
      ) : (
        <ol className="mt-3 space-y-2" style={{ touchAction: 'pan-y' }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
          {blocks.map((b) => {
            const label = hoursLabel(b.hours)
            if (b.kind === 'free') {
              return (
                <li key={`f${b.hours[0].hour}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-2.5">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-sm font-extrabold">{label}</p>
                    {validTime(b.hours[0].start) && <p className="text-xs text-muted">{b.hours[0].start}</p>}
                  </div>
                  <div>
                    <p className="font-semibold text-muted"><span className="language-text">{t('class.tt_free_hour')}</span></p>
                    <p className="text-xs text-muted"><span className="language-text">{t('class.tt_free_hour_sub')}</span></p>
                  </div>
                </li>
              )
            }
            const now = day === model.todayWd && model.currentHour !== null && b.hours.some((h) => h.hour === model.currentHour)
            return (
              <li
                key={`l${b.hours[0].hour}`}
                className={`flex gap-3 rounded-2xl border bg-surface px-3 py-3 ${now ? 'border-bordeaux ring-2 ring-bordeaux/30' : 'border-line'}`}
                style={{ borderLeftWidth: 5, borderLeftColor: subjectColor(data.subjects, b.slot.subject_code) }}
                aria-current={now ? 'time' : undefined}
              >
                <div className="w-16 shrink-0 text-center">
                  <p className="text-sm font-extrabold">{label}</p>
                  <p className="text-xs text-muted">{validTime(b.hours[0].start) ? b.hours[0].start : '—'}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-snug [overflow-wrap:anywhere]">{subjectName(data.subjects, b.slot.subject_code, lang)}</p>
                  <RoomLine slot={b.slot} hours={b.hours} />
                  {(b.slot.is_lab || now) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {now && <NowBadge />}
                      {b.slot.is_lab && <LabBadge />}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function WeekGrid({
  data, slots, hours, model, editing, onEdit, notes,
}: {
  data: TimetableData
  slots: Slot[]
  hours: HourSlot[]
  model: TimetableModel | null
  editing?: boolean
  onEdit?: (weekday: number, hour: number) => void
  /** Reason codes for cells the screenshot could not settle, keyed by weekday-hour. */
  notes?: Record<string, string>
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const days = model?.days ?? [0, 1, 2, 3, 4]
  const at = (w: number, h: number) => slots.find((s) => s.weekday === w && s.hour === h)
  const scroller = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ more: false, scrolled: false })
  const [detail, setDetail] = useState<{ weekday: number; hour: HourSlot; slot: Slot } | null>(null)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => setOverflow({ more: el.scrollLeft + el.clientWidth < el.scrollWidth - 2, scrolled: el.scrollLeft > 2 })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  const noteLabel = (code?: string) => code ? t(`class.tt_flag_${code}`, { defaultValue: code }) : ''
  const cellLabel = (w: number, h: HourSlot, s?: Slot) =>
    [
      t('class.tt_cell', { day: weekdayName(w, lang), hour: h.hour }),
      s ? subjectName(data.subjects, s.subject_code, lang) : t('class.tt_free_hour'),
      s?.room ? t('class.tt_room_value', { room: s.room }) : '',
      s?.is_lab ? t('class.tt_lab') : '',
      noteLabel(notes?.[`${w}-${h.hour}`]),
      model && w === model.todayWd && h.hour === model.currentHour && s ? t('class.tt_now') : '',
    ]
      .filter(Boolean)
      .join(', ')

  return (
    <div>
      <div className="relative">
        <div ref={scroller} className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1">
          <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-1 text-sm">
            <caption className="sr-only"><span className="language-text">{t('class.tt_week_caption')}</span></caption>
            <thead>
              <tr>
                <th scope="col" className={`sticky left-0 z-10 w-14 bg-paper ${overflow.scrolled ? 'shadow-[6px_0_8px_-6px_rgb(0_0_0/0.25)]' : ''}`}>
                  <span className="sr-only"><span className="language-text">{t('class.tt_hour_col')}</span></span>
                </th>
                {days.map((w) => {
                  const today = model?.todayWd === w
                  return (
                    <th key={w} scope="col" className={`rounded-lg px-1 py-2 text-xs font-bold ${today ? 'bg-bordeaux text-white' : 'bg-ink text-paper'}`}>
                      <span className="hidden sm:inline">{weekdayName(w, lang)}</span>
                      <span className="sm:hidden">{weekdayName(w, lang, 'short')}</span>
                      {today && <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-90"><span className="language-text">{t('class.tt_today')}</span></span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h.hour}>
                  <th scope="row" className={`sticky left-0 z-10 bg-paper pr-1 text-right align-middle text-xs font-normal text-muted ${overflow.scrolled ? 'shadow-[6px_0_8px_-6px_rgb(0_0_0/0.25)]' : ''}`}>
                    <span className="block font-bold text-ink"><span className="language-text">{t('class.tt_hour_short', { hour: h.hour })}</span></span>
                    {validTime(h.start) ? h.start : '—'}
                  </th>
                  {days.map((w) => {
                    const s = at(w, h.hour)
                    const note = notes?.[`${w}-${h.hour}`]
                    const now = !!s && !editing && model?.todayWd === w && model.currentHour === h.hour
                    const color = s ? subjectColor(data.subjects, s.subject_code) : undefined
                    const cls = `flex min-h-14 w-full flex-col justify-center rounded-lg border px-2 py-1 text-left ${
                      s ? (s.is_lab ? 'bg-verde-soft' : 'bg-surface') : 'border-dashed bg-transparent'
                    } ${note ? 'border-giallo ring-2 ring-giallo/50' : now ? 'border-bordeaux ring-2 ring-bordeaux/40' : 'border-line'}`
                    const content = s ? (
                      <>
                        <span className="flex items-center gap-1 font-bold">
                          <span className="truncate">{s.subject_code}</span>
                          {s.is_lab && <FlaskConical className="size-3.5 shrink-0 text-verde-ink" aria-hidden />}
                        </span>
                        <span className="block truncate text-[11px] text-muted">{s.room || '—'}</span>
                        {note && <span className="language-text block truncate text-[10px] font-semibold">{noteLabel(note)}</span>}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted/60" aria-hidden>—</span>
                        {note && <span className="language-text block truncate text-[10px] font-semibold">{noteLabel(note)}</span>}
                      </>
                    )
                    return (
                      <td key={w} className="align-top">
                        {editing ? (
                          <button className={`${cls} hover:border-ink/40`} style={color ? { borderLeftColor: color, borderLeftWidth: 4 } : undefined} onClick={() => onEdit?.(w, h.hour)} aria-label={cellLabel(w, h, s)}>
                            {content}
                          </button>
                        ) : s ? (
                          <button
                            className={`${cls} hover:border-ink/30`}
                            style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                            onClick={() => setDetail({ weekday: w, hour: h, slot: s })}
                            title={subjectName(data.subjects, s.subject_code, lang)}
                            aria-label={cellLabel(w, h, s)}
                            aria-haspopup="dialog"
                          >
                            {content}
                          </button>
                        ) : (
                          <div className={cls} role="img" aria-label={cellLabel(w, h)}>{content}</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {overflow.more && <div className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-l from-paper to-transparent" aria-hidden />}
      </div>
      {overflow.more && (
        <p className="mt-1 flex items-center justify-end gap-1 text-xs font-semibold text-muted" aria-hidden>
          <span className="language-text">{t('class.tt_scroll_hint')}</span> <ArrowRight className="size-3.5" />
        </p>
      )}
      {detail && <LessonModal data={data} {...detail} now={model?.todayWd === detail.weekday && model.currentHour === detail.hour.hour} onClose={() => setDetail(null)} />}
    </div>
  )
}

function LessonModal({ data, weekday, hour, slot, now, onClose }: { data: TimetableData; weekday: number; hour: HourSlot; slot: Slot; now: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  return (
    <Modal open onClose={onClose} title={t('class.tt_cell', { day: weekdayName(weekday, i18n.language), hour: hour.hour })}>
      <div className="rounded-2xl border border-line p-4" style={{ borderLeftWidth: 5, borderLeftColor: subjectColor(data.subjects, slot.subject_code) }}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{slot.subject_code}</p>
        <p className="text-lg font-extrabold [overflow-wrap:anywhere]">{subjectName(data.subjects as Subject[], slot.subject_code, i18n.language)}</p>
        <RoomLine slot={slot} hours={[hour]} />
        {(slot.is_lab || now) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {now && <NowBadge />}
            {slot.is_lab && <LabBadge />}
          </div>
        )}
      </div>
    </Modal>
  )
}
