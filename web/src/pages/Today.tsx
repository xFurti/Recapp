import { TranslatedMessage } from '../components/TranslatedMessage'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ExternalLink, Hand, Info, Paperclip, Pencil, TriangleAlert, X } from 'lucide-react'
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api, ApiError, attachmentUrl } from '../api'
import { CalendarButton } from '../components/CalendarButton'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { DayNotes, ListenButton } from '../components/day'
import { Feedback } from '../components/Feedback'
import { SubjectTag, TypeBadge } from '../components/items'
import { CorrectionInbox, ItemCorrectionControls, ItemCorrectionsProvider } from '../components/ItemCorrections'
import { ShareButton } from '../components/ShareButton'
import { ItemThanks } from '../components/Thanks'
import { Badge, Button, ErrorBox, Spinner } from '../components/ui'
import { daysBetween, parseDay, todayIso } from '../lib/clock'
import { capitalize, countdown, longDay, relativeDay, shortDay, subjectColor, subjectName, timeOf } from '../lib/format'
import { classPath, useClass, useToday } from '../queries'
import type { Item, ItemType, Lesson, Subject, TodayInfo } from '../types'

/** The stamp colour: green published, yellow draft, bordeaux your turn, blue no school; the rest stay neutral. */
type Tone = 'published' | 'draft' | 'yours' | 'no_school' | 'open' | 'waiting' | 'future'

const TICKET_COLOR: Record<ItemType, string> = { compito: 'var(--color-azzurro)', verifica: 'var(--color-rosa)', evento: 'var(--color-viola)', lab: 'var(--color-verde)' }

/** How long the opening page turn, tickets and stamp take together, plus a little slack. */
const INTRO_MS = 1400

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The day's lessons as coloured tabs along the top edge of the sheet. */
function LessonTabs({ lessons, subjects }: { lessons: Lesson[]; subjects: Subject[] }) {
  const { t, i18n } = useTranslation()
  if (!lessons.length) return <p className="today-tabs-empty"><span className="language-text">{t('today.no_lessons')}</span></p>
  return (
    <ol className="today-tabs" aria-label={t('today.lessons')} tabIndex={0}>
      {lessons.map((l) => (
        <li key={`${l.subject_code}-${l.hours_label}`} className="today-tab" style={{ '--subject': subjectColor(subjects, l.subject_code) } as CSSProperties}>
          <span className="today-tab-hour text-[11px] font-semibold text-muted">
            <span className="language-text">{l.hours.length > 1 ? t('day.hours', { h: l.hours_label }) : t('day.hour', { h: l.hours_label })}</span> · {l.start}
          </span>
          <span className="today-tab-name text-sm font-bold leading-tight" title={subjectName(subjects, l.subject_code, i18n.language)}>{subjectName(subjects, l.subject_code, i18n.language)}</span>
          {(l.room || l.is_lab) && (
            <span className="today-tab-room mt-0.5 items-center gap-1 text-[11px] text-muted">
              {l.room}
              {l.is_lab && <Badge className="bg-verde-soft px-1.5 py-0 text-verde-ink"><span className="language-text">{t('day.lab')}</span></Badge>}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

/** One deadline of the next days, drawn as a ticket. */
function Ticket({ item, subjects, index }: { item: Item; subjects: Subject[]; index: number }) {
  const { t, i18n } = useTranslation()
  const diff = daysBetween(todayIso(), item.due_date)
  const urgent = item.type === 'verifica' && diff >= 0 && diff <= 3
  return (
    <li className="today-ticket" data-ticket data-urgent={urgent || undefined} style={{ '--i': index, '--ticket': TICKET_COLOR[item.type] } as CSSProperties}>
      <div className="today-ticket-stub">
        <span className="min-w-0 font-bold">
          {relativeDay(item.due_date, t, i18n.language)}
          {urgent && <span className="sr-only"> · {countdown(item.due_date, t)}</span>}
        </span>
        <span className="flex shrink-0 items-center">
          <ItemThanks item={item} />
          {item.status === 'published' && <CalendarButton item={item} subjects={subjects} compact />}
        </span>
      </div>
      <div className="today-ticket-tear" aria-hidden />
      <div className="today-ticket-body">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TypeBadge type={item.type} />
          <SubjectTag subjects={subjects} code={item.subject_code} />
        </div>
        <p className="mt-1 font-semibold leading-snug [overflow-wrap:anywhere]">{item.title}</p>
        {(item.link || item.attachment_id) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
            {item.link && (
              <a href={item.link} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-9 items-center gap-1 font-semibold text-azzurro-ink hover:underline">
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="language-text">{t('upcoming.open_link')}</span>
              </a>
            )}
            {item.attachment_id && (
              <a href={attachmentUrl(item.attachment_id)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 font-semibold text-azzurro-ink hover:underline" aria-label={t('day.attachments')}>
                <Paperclip className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        )}
        <ItemCorrectionControls item={item} />
      </div>
    </li>
  )
}

function Tickets({ items, subjects, code }: { items: Item[]; subjects: Subject[]; code: string }) {
  const { t } = useTranslation()
  const titleId = useId()
  return (
    <section className="today-soon" aria-labelledby={titleId}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3">
        <h2 id={titleId} className="text-xs font-bold uppercase tracking-wide text-muted sm:text-sm"><span className="language-text">{t('today.soon')}</span></h2>
        <Link to={`/c/${code}/in-arrivo`} className="-my-2 inline-flex min-h-9 items-center text-xs font-semibold text-bordeaux hover:underline sm:text-sm">
          <span className="language-text">{t('today.all_upcoming')}</span>
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted"><span className="language-text">{t('today.soon_empty')}</span></p>
      ) : (
        <ol className="today-tickets" aria-labelledby={titleId} tabIndex={items.length > 1 ? 0 : undefined}>
          {items.map((it, i) => <Ticket key={it.id} item={it} subjects={subjects} index={i} />)}
        </ol>
      )}
    </section>
  )
}

function TodaySheet({ data }: { data: TodayInfo }) {
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
  // The opening turn plays once per visit: data refreshes, language and theme changes never restart it.
  const [intro, setIntro] = useState(() => !reducedMotion())
  useEffect(() => {
    if (!intro) return
    const id = window.setTimeout(() => setIntro(false), INTRO_MS)
    return () => window.clearTimeout(id)
  }, [intro])

  let tone: Tone = 'waiting'
  let stamp = ''
  let stampDetail: ReactNode = null
  let title: ReactNode = null
  let sub: ReactNode = null
  let actions: ReactNode = null
  let secondary: ReactNode = null

  const passBtn = data.can_pass && (
    <Button variant="ghost" size="sm" onClick={() => setConfirmPass(true)} className="today-pass">
      <Hand className="size-4" aria-hidden /> <span className="language-text">{t('banner.pass')}</span>
    </Button>
  )
  const adminWrite = data.can_write && !data.is_me_scribe && data.status !== 'published' && (
    <Button variant="secondary" onClick={write} data-tour="write" className="today-action">
      <Pencil className="size-4" aria-hidden /> <span className="language-text">{t('banner.write_admin')}</span>
    </Button>
  )

  switch (data.status) {
    case 'no_school':
      tone = 'no_school'
      stamp = t('stamp.no_school')
      title = data.no_school_reason === 'weekend' ? <span className="language-text">{t('banner.weekend')}</span> : data.no_school_reason || <span className="language-text">{t('banner.no_school')}</span>
      sub = data.next_school_day && (
        <>
          <span className="language-text">{t('banner.next_day', { day: shortDay(data.next_school_day.day, lang) })}</span>
          {data.next_school_day.scribe && <> · <TranslatedMessage message="banner.next_scribe" values={{ nick: data.next_school_day.scribe.nick }} /></>}
        </>
      )
      break
    case 'published':
      tone = 'published'
      stamp = t('stamp.published')
      stampDetail = (
        <>
          <span className="today-stamp-line"><b>{data.card?.author?.nick ?? nick}</b> · {timeOf(data.card?.published_at, lang)}</span>
          {data.card?.updated_by && <span className="today-stamp-line"><TranslatedMessage message="day.updated_by" values={{ nick: data.card.updated_by.nick }} /></span>}
        </>
      )
      actions = data.can_write && (
        <Button variant="secondary" onClick={write} data-tour="write" className="today-action">
          <Pencil className="size-4" aria-hidden /> <span className="language-text">{t('banner.edit')}</span>
        </Button>
      )
      break
    case 'draft':
      tone = data.is_me_scribe ? 'yours' : 'draft'
      stamp = data.is_me_scribe ? t('stamp.yours') : t('stamp.draft')
      stampDetail = data.draft_updated_at && <span className="today-stamp-line"><TranslatedMessage message="banner.draft_sub" values={{ time: timeOf(data.draft_updated_at, lang) }} /></span>
      title = data.is_me_scribe ? <span className="language-text">{t('banner.me_draft')}</span> : <TranslatedMessage message="banner.draft" values={{ nick }} />
      if (data.is_me_scribe) sub = <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span>
      actions = data.can_write && <Button size="lg" onClick={write} data-tour="write" className="today-action"><span className="language-text">{data.is_me_scribe || data.has_draft ? t('banner.continue') : t('banner.write')}</span> <ArrowRight className="size-4" aria-hidden /></Button>
      secondary = passBtn
      break
    case 'open':
      if (data.is_me_scribe) {
        tone = 'yours'
        stamp = t('stamp.yours')
        title = <span className="language-text">{t('banner.me_open')}</span>
        actions = <Button size="lg" onClick={write} data-tour="write" className="today-action"><span className="language-text">{data.has_draft ? t('banner.continue') : t('banner.write')}</span> <ArrowRight className="size-4" aria-hidden /></Button>
      } else {
        tone = 'open'
        stamp = t('stamp.open')
        title = data.scribe
          ? <TranslatedMessage message="banner.open_missing" values={{ nick }} />
          : data.override_reason === 'pass' ? <span className="language-text">{t('banner.open_pass')}</span> : <span className="language-text">{t('banner.open_nobody')}</span>
        sub = <span className="language-text">{t('banner.open_sub')}</span>
        actions = (data.can_takeover || adminWrite) && (
          <>
            {data.can_takeover && (
              <Button size="lg" onClick={() => takeover.mutate(undefined, { onSuccess: write })} loading={takeover.isPending} className="today-action">
                <Hand className="size-4" aria-hidden /> <span className="language-text">{t('banner.takeover')}</span>
              </Button>
            )}
            {adminWrite}
          </>
        )
      }
      break
    case 'future':
      tone = 'future'
      stamp = t('stamp.future')
      title = <span className="language-text">{t('banner.future')}</span>
      break
    default:
      if (data.is_me_scribe) {
        tone = 'yours'
        stamp = t('stamp.yours')
        title = <span className="language-text">{t('banner.me_not_started')}</span>
        sub = <><span className="language-text">{t('banner.me_sub')}</span> <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
        actions = <Button size="lg" onClick={write} data-tour="write" className="today-action"><span className="language-text">{t('banner.write')}</span> <ArrowRight className="size-4" aria-hidden /></Button>
        secondary = passBtn
      } else {
        stamp = data.override_reason === 'takeover' ? t('stamp.taken') : t('stamp.waiting')
        title = data.override_reason === 'takeover'
          ? <TranslatedMessage message="banner.taken_over" values={{ nick }} />
          : <TranslatedMessage message="banner.not_started" values={{ nick }} />
        sub = <><span className="language-text">{t('banner.not_started_sub')}</span> <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
        actions = adminWrite
      }
  }

  const published = data.status === 'published' && data.card
  const canShare = !!published && (info.viewer.can_manage || info.viewer.member?.id === data.card!.author?.id)
  return (
    <div className="today-page">
      {data.is_school_day && <LessonTabs lessons={data.lessons} subjects={info.subjects} />}
      <article className="today-sheet" data-tone={tone} data-intro={intro || undefined} aria-labelledby="today-date">
        <span className="today-leaf" aria-hidden />
        <header className="today-head">
          <p className="today-eyebrow hidden text-sm md:block font-semibold uppercase tracking-wide text-bordeaux"><span className="language-text">{t('nav.today')}</span></p>
          <h1 id="today-date" className="today-date text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{capitalize(longDay(data.day, lang))}</h1>
          <div className="today-status">
            <p className="today-stamp" aria-live="polite">
              <span className="today-stamp-label language-text">{stamp}</span>
              {stampDetail}
            </p>
            {data.open_corrections > 0 && data.can_write && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-giallo px-3 py-1 text-sm font-bold text-[#1d1b1e]">
                <TriangleAlert className="size-4" aria-hidden /> <span className="language-text">{t('feedback.open_corrections', { count: data.open_corrections })}</span>
              </p>
            )}
          </div>
          {actions && <div className="today-actions">{actions}</div>}
          {secondary && <div className="today-secondary">{secondary}</div>}
          {takeover.error && <p role="alert" className="today-error text-sm font-medium text-rosa-ink">{(takeover.error as Error).message}</p>}
        </header>

        {leftTurn && (
          <div role="status" className="today-block flex items-start gap-3 rounded-2xl border border-bordeaux/25 bg-bordeaux-soft p-4 text-ink">
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
        {info.is_demo && isWeekend(data.day) && <div className="today-block"><DemoWeekendNote /></div>}
        <div className="today-block empty:hidden"><CorrectionInbox /></div>

        <Tickets items={data.upcoming_soon} subjects={info.subjects} code={info.code} />

        {published ? (
          <>
            <DayNotes
              card={data.card!}
              subjects={info.subjects}
              actions={<>{canShare && <ShareButton card={data.card!} info={info} />}<ListenButton card={data.card!} subjects={info.subjects} /></>}
            />
            <div className="today-block today-measure">
              <Feedback code={info.code} day={data.day} readOnly={info.viewer.read_only} />
            </div>
          </>
        ) : (
          <section className="today-invite" aria-labelledby="today-invite-title">
            <p id="today-invite-title" className="text-xl font-semibold leading-snug">{title}</p>
            {sub && <p className="mt-2 text-[15px] text-ink/75">{sub}</p>}
          </section>
        )}
      </article>
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
    </div>
  )
}

export function isWeekend(iso: string): boolean {
  const wd = parseDay(iso).getDay()
  return wd === 0 || wd === 6
}

export function DemoWeekendNote() {
  const { t } = useTranslation()
  return (
    <p className="flex gap-2 rounded-xl border border-azzurro/20 bg-azzurro-soft px-3 py-2 text-sm text-azzurro-ink">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> <span className="language-text">{t('banner.demo_weekend')}</span>
    </p>
  )
}

export default function Today() {
  const info = useClass()
  const today = useToday(info.code)
  if (today.isLoading) return <Spinner />
  if (today.error) return <ErrorBox error={today.error} onRetry={() => today.refetch()} />
  return (
    <ItemCorrectionsProvider>
      <TodaySheet data={today.data!} />
    </ItemCorrectionsProvider>
  )
}
