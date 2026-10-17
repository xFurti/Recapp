import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowRight, CalendarCheck, Check, Clock, ExternalLink, Hand, Paperclip, Pencil, StickyNote, Sun, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api, ApiError, attachmentUrl } from '../api'
import { daysBetween, todayIso } from '../lib/clock'
import { useReducedMotion } from '../lib/contribution-motion'
import { capitalize, longDay, subjectColor, subjectName, timeOf } from '../lib/format'
import { buildTimeline, dayTone, enter, entryHasContent, groupByDay, spotlight, urgency, type DayTone, type TimelineStop } from '../lib/today'
import { classPath, useClass } from '../queries'
import type { Card, Item, Subject, TodayInfo } from '../types'
import { CalendarButton } from './CalendarButton'
import { ConfirmationDialog } from './ConfirmationDialog'
import { EntryPhotos, LabBox, ListenButton } from './day'
import { ItemCorrectionControls } from './ItemCorrections'
import { ItemRow, SubjectTag, TypeBadge } from './items'
import { ShareButton } from './ShareButton'
import { ItemThanks } from './Thanks'
import { TranslatedMessage } from './TranslatedMessage'
import { Avatar, Badge, Button, Modal } from './ui'

/** Counts up once when it first appears; with reduced motion the final number is there at once. */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (reduced) return
    let frame = 0
    const start = performance.now()
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / 600)
      setShown(Math.round((1 - (1 - progress) ** 3) * value))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  return <span className="tabular-nums">{reduced ? value : shown}</span>
}

/** "Domani" or a big counted number with "tra … giorni" around it. Screen readers get the plain phrase. */
function Countdown({ days, size = 'md' }: { days: number; size?: 'md' | 'lg' }) {
  const { t } = useTranslation()
  const word = days === 0 ? t('dates.today') : days === 1 ? t('dates.tomorrow') : null
  return (
    <>
      <span className="sr-only">{word ?? t('dates.in_days', { count: days })}</span>
      <span aria-hidden className="flex flex-col items-center leading-none">
        {word ? (
          <span className={`language-text font-extrabold ${size === 'lg' ? 'text-3xl' : 'text-sm'}`}>{word}</span>
        ) : (
          <>
            <span className="language-text text-[0.7rem] font-semibold uppercase tracking-wide opacity-80">{t('today.stub_in')}</span>
            <span className={`font-extrabold ${size === 'lg' ? 'text-5xl' : 'text-3xl'}`}><CountUp value={days} /></span>
            <span className="language-text text-[0.7rem] font-semibold uppercase tracking-wide opacity-80">{t('today.stub_days')}</span>
          </>
        )}
      </span>
    </>
  )
}

const TONE_ICON: Partial<Record<DayTone, ReactNode>> = {
  draft: <Pencil className="size-3.5" aria-hidden />,
  no_school: <Sun className="size-3.5" aria-hidden />,
  future: <Clock className="size-3.5" aria-hidden />,
  waiting: <Clock className="size-3.5" aria-hidden />,
  taken: <Hand className="size-3.5" aria-hidden />,
}

export function StatusChip({ tone }: { tone: DayTone }) {
  const { t } = useTranslation()
  return (
    <span className="today-status" data-tone={tone}>
      {tone === 'published' ? (
        <svg viewBox="0 0 24 24" className="today-status-check size-4" aria-hidden>
          <path pathLength={1} d="M6.5 12.5 10.2 16 17.5 8.5" />
        </svg>
      ) : tone === 'mine' || tone === 'open' ? (
        <span className="today-status-dot" aria-hidden />
      ) : TONE_ICON[tone]}
      <span className="language-text">{t(`today.state.${tone}`)}</span>
    </span>
  )
}

/** Big date, the state of the day, who published it and the one action that matters now. */
export function TodayHeader({ data }: { data: TodayInfo }) {
  const { t, i18n } = useTranslation()
  const info = useClass()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const lang = i18n.language
  const nick = data.scribe?.nick ?? ''
  const write = () => navigate(`/c/${info.code}/scrivi/${data.day}`)
  const refresh = () => qc.invalidateQueries({ queryKey: ['today', info.code] })

  const takeover = useMutation({ mutationFn: () => api.post(classPath(info.code, '/today/takeover'), { day: data.day }), onSuccess: refresh })
  const [confirmPass, setConfirmPass] = useState(false)
  const [leftTurn, setLeftTurn] = useState(false)

  let who: { nick: string; color: string } | null = data.scribe
  let title: ReactNode = null
  let sub: ReactNode = null
  let actions: ReactNode = null

  // Secondary: it sits with the explanation of the turn, so the main action keeps its own row on a phone.
  const passBtn = data.can_pass && (
    <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setConfirmPass(true)}>
      <Hand className="size-4" /> <span className="language-text">{t('banner.pass')}</span>
    </Button>
  )
  const adminWrite = data.can_write && !data.is_me_scribe && data.status !== 'published' && (
    <Button variant="secondary" onClick={write} data-tour="write">
      <Pencil className="size-4" /> <span className="language-text">{t('banner.write_admin')}</span>
    </Button>
  )

  switch (data.status) {
    case 'no_school':
      who = null
      title = <span className="language-text">{t('banner.no_school')}</span>
      sub = data.no_school_reason === 'weekend' ? <span className="language-text">{t('banner.weekend')}</span> : data.no_school_reason
      break
    case 'published':
      who = data.card?.author ?? data.scribe
      title = <TranslatedMessage message="banner.published" values={{ nick: data.card?.author?.nick ?? nick, time: timeOf(data.card?.published_at, lang) }} />
      sub = data.card?.updated_by && <TranslatedMessage message="day.updated_by" values={{ nick: data.card.updated_by.nick }} />
      actions = data.can_write && (
        <Button variant="secondary" onClick={write} data-tour="write">
          <Pencil className="size-4" /> <span className="language-text">{t('banner.edit')}</span>
        </Button>
      )
      break
    case 'draft':
      title = data.is_me_scribe ? <span className="language-text">{t('banner.me_draft')}</span> : <TranslatedMessage message="banner.draft" values={{ nick }} />
      sub = data.draft_updated_at ? <TranslatedMessage message="banner.draft_sub" values={{ time: timeOf(data.draft_updated_at, lang) }} /> : null
      if (data.is_me_scribe) sub = <>{sub} · <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
      actions = data.can_write && <Button onClick={write} data-tour="write"><span className="language-text">{data.is_me_scribe || data.has_draft ? t('banner.continue') : t('banner.write')}</span> <ArrowRight className="size-4" /></Button>
      break
    case 'open':
      if (data.is_me_scribe) {
        title = <span className="language-text">{t('banner.me_open')}</span>
        actions = <Button onClick={write} data-tour="write"><span className="language-text">{data.has_draft ? t('banner.continue') : t('banner.write')}</span> <ArrowRight className="size-4" /></Button>
      } else {
        title = data.scribe
          ? <TranslatedMessage message="banner.open_missing" values={{ nick }} />
          : data.override_reason === 'pass' ? <span className="language-text">{t('banner.open_pass')}</span> : <span className="language-text">{t('banner.open_nobody')}</span>
        sub = <span className="language-text">{t('banner.open_sub')}</span>
        actions = (
          <>
            {data.can_takeover && (
              <Button onClick={() => takeover.mutate(undefined, { onSuccess: write })} loading={takeover.isPending}>
                <Hand className="size-4" /> <span className="language-text">{t('banner.takeover')}</span>
              </Button>
            )}
            {adminWrite}
          </>
        )
      }
      break
    case 'future':
      title = <span className="language-text">{t('banner.future')}</span>
      break
    default:
      if (data.is_me_scribe) {
        title = <span className="language-text">{t('banner.me_not_started')}</span>
        sub = <><span className="language-text">{t('banner.me_sub')}</span> <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
        actions = <Button onClick={write} data-tour="write"><span className="language-text">{t('banner.write')}</span> <ArrowRight className="size-4" /></Button>
      } else {
        title = data.override_reason === 'takeover'
          ? <TranslatedMessage message="banner.taken_over" values={{ nick }} />
          : <TranslatedMessage message="banner.not_started" values={{ nick }} />
        sub = <><span className="language-text">{t('banner.not_started_sub')}</span> <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
        actions = adminWrite
      }
  }

  const words = capitalize(longDay(data.day, lang)).split(' ')
  return (
    <header className="today-enter" style={enter(0)}>
      {leftTurn && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-bordeaux/25 bg-bordeaux-soft p-4 text-ink">
          <Hand className="mt-0.5 size-5 shrink-0 text-bordeaux" aria-hidden />
          <p className="min-w-0 flex-1 text-sm leading-relaxed">
            <span className="language-text font-bold">{t('banner.pass_left_title')}</span>{' '}
            <span className="language-text">{t('banner.pass_left_body')}</span>
          </p>
          <button type="button" onClick={() => setLeftTurn(false)} aria-label={t('common.close')} className="rounded-full p-1 text-muted hover:bg-ink/5">
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-bordeaux"><span className="language-text">{t('nav.today')}</span></p>
        <StatusChip tone={dayTone(data)} />
      </div>
      <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-3">
        <h1 className="today-date min-w-0 flex-[1_1_16rem] text-[1.75rem] font-extrabold leading-[1.1] tracking-tight sm:text-4xl xl:text-5xl">
          {words.map((word, i) => <span key={`${i}-${word}`}>{i > 0 && ' '}<span className="today-date-word" style={{ '--w': i } as CSSProperties}>{word}</span></span>)}
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <section aria-live="polite" className="mt-3 flex items-start gap-3">
        {data.status === 'no_school' ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-azzurro-soft text-azzurro-ink"><Sun className="size-5" aria-hidden /></span>
        ) : who ? <Avatar nick={who.nick} color={who.color} /> : null}
        <div className="min-w-0 flex-1 self-center [overflow-wrap:anywhere]">
          <p className="leading-snug">{title}</p>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
          {(data.status === 'draft' || data.status === 'not_started') && passBtn && <div className="mt-1">{passBtn}</div>}
        </div>
      </section>
      {data.open_corrections > 0 && data.can_write && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-giallo px-3 py-1 text-sm font-bold text-[#1d1b1e]">
          <TriangleAlert className="size-4" /> <span className="language-text">{t('feedback.open_corrections', { count: data.open_corrections })}</span>
        </p>
      )}
      {takeover.error && <p className="mt-2 text-sm font-medium text-rosa-ink">{(takeover.error as Error).message}</p>}
      {confirmPass && (
        <ConfirmationDialog
          title={t('banner.pass_title')}
          description={t('banner.pass_description')}
          confirmLabel={t('banner.pass_action')}
          pendingLabel={t('banner.pass_pending')}
          errorLabel={t('banner.pass_error')}
          confirmVariant="primary"
          iconClassName="bg-bordeaux-soft text-bordeaux"
          icon={<Hand className="size-6" aria-hidden />}
          onConfirm={async () => {
            try {
              await api.post(classPath(info.code, '/today/pass'), { day: data.day })
            } catch (caught) {
              if (caught instanceof ApiError && caught.status === 409) {
                await qc.invalidateQueries({ queryKey: ['today', info.code] })
                const unavailable = new Error(t('banner.pass_unavailable'))
                unavailable.name = 'ActionUnavailable'
                throw unavailable
              }
              throw caught
            }
          }}
          onClose={(confirmed) => {
            setConfirmPass(false)
            if (!confirmed) return
            setLeftTurn(true)
            refresh()
          }}
        />
      )}
    </header>
  )
}

/** Brings a deadline ticket into view and puts focus on it, so the jump is visible and audible. */
function showDeadline(id: number) {
  const ticket = document.getElementById(`deadline-${id}`)
  if (!ticket) return
  ticket.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  ticket.focus({ preventScroll: true })
  ticket.classList.remove('is-flashing')
  void ticket.offsetWidth
  ticket.classList.add('is-flashing')
}

/** Homework given today and due soon: the full card is among the deadlines, here only a pointer to it. */
function DeadlineLink({ item }: { item: Item }) {
  const { t } = useTranslation()
  const days = daysBetween(todayIso(), item.due_date)
  return (
    <button type="button" onClick={() => showDeadline(item.id)} className="today-pointer flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-line px-3 py-2 text-left text-sm">
      <TypeBadge type={item.type} />
      <span className="min-w-[min(100%,10rem)] flex-1 break-words font-semibold">{item.title}</span>
      <span className="language-text shrink-0 text-xs font-semibold text-muted">{days === 0 ? t('dates.today') : days === 1 ? t('dates.tomorrow') : t('dates.in_days', { count: days })}</span>
      <ArrowDown className="today-pointer-arrow size-4 shrink-0 text-muted xl:-rotate-90" aria-hidden />
      <span className="sr-only">{t('today.see_deadline')}</span>
    </button>
  )
}

function AssignedItems({ items, soon, subjects }: { items: Item[]; soon: Set<number>; subjects: Subject[] }) {
  if (!items.length) return null
  return (
    <div className="mt-3 space-y-2">
      {items.map((it) => soon.has(it.id) ? <DeadlineLink key={it.id} item={it} /> : <ItemRow key={it.id} item={it} subjects={subjects} compact />)}
    </div>
  )
}

function Stop({ stop, index, items, soon, subjects }: { stop: TimelineStop; index: number; items: Item[]; soon: Set<number>; subjects: Subject[] }) {
  const { t, i18n } = useTranslation()
  const { lesson, entry } = stop
  const hours = lesson?.hours_label ?? entry?.hours ?? ''
  const multiple = lesson ? lesson.hours.length > 1 : hours.includes('-')
  const room = lesson?.room || entry?.room
  const lab = entry?.is_lab || lesson?.is_lab
  return (
    <li className="today-stop today-enter" data-phase={stop.phase ?? undefined} style={{ ...enter(index), '--subject': subjectColor(subjects, stop.subject_code) } as CSSProperties}>
      <span className="today-stop-marker" aria-hidden>
        {stop.phase === 'past' && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="today-stop-head flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="font-bold leading-tight break-words">{subjectName(subjects, stop.subject_code, i18n.language)}</h3>
          <span className="text-xs font-medium text-muted">
            {hours && <span className="language-text">{multiple ? t('day.hours', { h: hours }) : t('day.hour', { h: hours })}</span>}
            {lesson && <> · {lesson.start}–{lesson.end}</>}
            {room && !lab && <> · {room}</>}
          </span>
          {lab && <Badge className="bg-verde-soft text-verde-ink"><span className="language-text">{t('day.lab')}</span> {room}</Badge>}
          {entry && entry.lesson_status !== 'svolta' && <Badge className="bg-giallo-soft text-ink"><span className="language-text">{t(`day.status_${entry.lesson_status}`)}</span></Badge>}
          {stop.phase === 'now' && <Badge className="today-now bg-bordeaux text-white"><span className="language-text">{t('today.now')}</span></Badge>}
        </div>
        {entry && entry.bullets.length > 0 && (
          <ul className="mt-1.5 max-w-[68ch] list-disc space-y-1 pl-5 text-[15px] leading-relaxed marker:text-muted">
            {entry.bullets.map((b, j) => <li key={j}>{b}</li>)}
          </ul>
        )}
        {entry && <EntryPhotos ids={entry.attachment_ids ?? []} />}
        {entry && <LabBox entry={entry} />}
        <AssignedItems items={items} soon={soon} subjects={subjects} />
      </div>
    </li>
  )
}

/** The hours of the day as one timeline, each with its notes and the homework given in it. */
export function LessonTimeline({ data, published, invite }: { data: TodayInfo; published: Card | null; invite?: ReactNode }) {
  const info = useClass()
  const { t } = useTranslation()
  const [zoom, setZoom] = useState<number | null>(null)
  const entries = published ? published.entries.filter((e) => entryHasContent(e)) : []
  const stops = buildTimeline(data.lessons, entries, data.now, data.day)
  const soon = new Set(data.upcoming_soon.map((it) => it.id))
  const assigned = published?.items ?? []
  const placed = new Set<number>()
  const itemsFor = (stop: TimelineStop) => {
    if (stops.find((s) => s.subject_code === stop.subject_code) !== stop) return []
    const list = assigned.filter((it) => it.subject_code === stop.subject_code)
    list.forEach((it) => placed.add(it.id))
    return list
  }
  const stopItems = stops.map(itemsFor)
  const loose = assigned.filter((it) => !placed.has(it.id))
  const canShare = info.viewer.can_manage || info.viewer.member?.id === published?.author?.id
  return (
    <section className="today-card today-enter" style={enter(2)} onPointerMove={spotlight} aria-labelledby="today-lessons">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h2 id="today-lessons" className="mr-auto text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t(published ? 'today.lessons_notes' : 'today.lessons')}</span></h2>
        {published && canShare && <ShareButton card={published} info={info} />}
        {published && <ListenButton card={published} subjects={info.subjects} />}
      </header>
      {invite}
      <div className="px-4 py-4 sm:px-5">
        {stops.length === 0 ? (
          <p className="text-sm text-muted"><span className="language-text">{t(published ? 'day.nothing_written' : 'today.no_lessons')}</span></p>
        ) : (
          <ol className="today-timeline">
            {stops.map((stop, i) => <Stop key={stop.key} stop={stop} index={i} items={stopItems[i]} soon={soon} subjects={info.subjects} />)}
          </ol>
        )}
      </div>
      {loose.length > 0 && (
        <section className="border-t border-line bg-paper/60 px-4 py-4 sm:px-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('day.assigned')}</span></h3>
          <AssignedItems items={loose} soon={soon} subjects={info.subjects} />
        </section>
      )}
      {published?.notes && (
        <section className="border-t border-line px-4 py-4 sm:px-5">
          <div className="max-w-[72ch] rounded-xl bg-giallo-soft p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
              <StickyNote className="size-4" /> <span className="language-text">{t('day.notes')}</span>
            </p>
            <p className="whitespace-pre-line text-[15px]">{published.notes}</p>
          </div>
        </section>
      )}
      {published && published.attachments.length > 0 && (
        <section className="border-t border-line px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('day.attachments')}</span></h3>
          <div className="flex flex-wrap gap-2">
            {published.attachments.map((a) => (
              <button key={a.id} onClick={() => setZoom(a.id)} className="overflow-hidden rounded-lg border border-line" aria-label={t('day.photo_open')}>
                <img src={attachmentUrl(a.id)} alt="" className="h-24 w-auto object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <Modal open={zoom !== null} onClose={() => setZoom(null)} title={t('day.attachments')} wide>
            {zoom !== null && <img src={attachmentUrl(zoom)} alt="" className="w-full rounded-lg" />}
          </Modal>
        </section>
      )}
    </section>
  )
}

/** What fills the summary's place while the day is not written yet. */
export function WriteInvite({ data }: { data: TodayInfo }) {
  const { t } = useTranslation()
  const key = data.status === 'future' ? 'future' : data.is_me_scribe || (data.status === 'open' && data.can_takeover) ? 'yours' : 'waiting'
  return (
    <div className="today-invite mx-4 mt-4 flex items-start gap-3 rounded-xl border border-dashed p-3 sm:mx-5" data-kind={key}>
      <Pencil className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="language-text text-sm">{t(`today.invite_${key}`, { nick: data.scribe?.nick ?? '' })}</p>
    </div>
  )
}

function Ticket({ item, index, fresh, subjects }: { item: Item; index: number; fresh: boolean; subjects: Subject[] }) {
  const { t } = useTranslation()
  const days = daysBetween(todayIso(), item.due_date)
  return (
    <li id={`deadline-${item.id}`} tabIndex={-1} className="today-ticket today-enter" data-urgency={urgency(todayIso(), item.due_date)} style={enter(index)}>
      <div className="today-ticket-stub"><Countdown days={days} /></div>
      <div className="min-w-0 flex-1 py-2.5 pl-4 pr-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TypeBadge type={item.type} />
          <SubjectTag subjects={subjects} code={item.subject_code} />
          {fresh && <Badge className="bg-bordeaux-soft text-bordeaux"><span className="language-text">{t('today.new_today')}</span></Badge>}
        </div>
        <p className="mt-1 break-words font-semibold leading-snug">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
          <span className="language-text">{t(`sources.${item.source}`, { defaultValue: item.source })}</span>
          {item.author && <> · <TranslatedMessage message="upcoming.added_by" values={{ nick: item.author.nick }} /></>}
        </p>
        <div className="today-ticket-actions mt-1.5 flex flex-wrap items-center gap-1">
          {item.status === 'published' && <CalendarButton item={item} subjects={subjects} compact />}
          <ItemThanks item={item} />
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer noopener" className="today-icon-action" title={t('upcoming.open_link')} aria-label={t('upcoming.open_link')}>
              <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
          {item.attachment_id && (
            <a href={attachmentUrl(item.attachment_id)} target="_blank" rel="noreferrer" className="today-icon-action" title={t('today.attachment')} aria-label={t('today.attachment')}>
              <Paperclip className="size-4" aria-hidden />
            </a>
          )}
          <span className="ml-auto"><ItemCorrectionControls item={item} compact /></span>
        </div>
      </div>
    </li>
  )
}

/** Deadlines of the next days, grouped by day, above the notes on a phone and beside them on a computer. */
export function Deadlines({ data, index }: { data: TodayInfo; index: number }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const fresh = new Set((data.card?.status === 'published' ? data.card.items : []).map((it) => it.id))
  const groups = groupByDay(data.upcoming_soon)
  let n = 0
  return (
    <section className="today-enter" style={enter(index)} aria-labelledby="today-soon">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="today-soon" className="text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('today.soon')}</span></h2>
        <Link to={`/c/${info.code}/in-arrivo`} className="today-more inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-bordeaux hover:underline">
          <span className="language-text">{t('today.all_upcoming')}</span> <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted"><CalendarCheck className="size-4 shrink-0 text-verde-ink" aria-hidden /><span className="language-text">{t('today.soon_empty')}</span></p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.day}>
              <h3 className="mb-1.5 text-xs font-bold text-muted">{capitalize(longDay(group.day, i18n.language))}</h3>
              <ul className="space-y-2">
                {group.items.map((item) => <Ticket key={item.id} item={item} index={index + n++} fresh={fresh.has(item.id)} subjects={info.subjects} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Weekend or holiday: why, how long until school, and who writes that day. */
export function NextSchoolDay({ data }: { data: TodayInfo }) {
  const { t, i18n } = useTranslation()
  const next = data.next_school_day
  if (!next) return null
  const days = daysBetween(data.day, next.day)
  return (
    <section className="today-card today-rest today-enter flex flex-wrap items-center gap-5 p-5" style={enter(2)} onPointerMove={spotlight} aria-labelledby="today-next">
      <div className="today-rest-count flex min-w-24 flex-col items-center justify-center rounded-2xl px-4 py-3"><Countdown days={days} size="lg" /></div>
      <div className="min-w-0 flex-[1_1_12rem]">
        <h2 id="today-next" className="text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('today.back_to_school')}</span></h2>
        <p className="mt-1 text-xl font-extrabold tracking-tight">{capitalize(longDay(next.day, i18n.language))}</p>
        <p className="mt-2 flex items-center gap-2 text-sm [overflow-wrap:anywhere]">
          {next.scribe ? (
            <>
              <Avatar nick={next.scribe.nick} color={next.scribe.color} size="sm" />
              <span><TranslatedMessage message="today.next_scribe" values={{ nick: next.scribe.nick }} /></span>
            </>
          ) : <span className="language-text text-muted">{t('today.next_no_scribe')}</span>}
        </p>
      </div>
    </section>
  )
}
