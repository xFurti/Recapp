import { TranslatedMessage } from '../components/TranslatedMessage'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Hand, Info, Pencil, PartyPopper, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { DayCardView, LessonsStrip } from '../components/day'
import { Feedback } from '../components/Feedback'
import { ItemRow } from '../components/items'
import { Avatar, Button, Card, ErrorBox, Spinner } from '../components/ui'
import { parseDay } from '../lib/clock'
import { capitalize, longDay, shortDay, timeOf } from '../lib/format'
import { classPath, useClass, useToday } from '../queries'
import type { TodayInfo } from '../types'

function ScribeBanner({ data }: { data: TodayInfo }) {
  const { t, i18n } = useTranslation()
  const info = useClass()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const lang = i18n.language
  const nick = data.scribe?.nick ?? ''
  const write = () => navigate(`/c/${info.code}/scrivi/${data.day}`)
  const refresh = () => qc.invalidateQueries({ queryKey: ['today', info.code] })

  const takeover = useMutation({ mutationFn: () => api.post(classPath(info.code, '/today/takeover'), { day: data.day }), onSuccess: refresh })
  const pass = useMutation({ mutationFn: () => api.post(classPath(info.code, '/today/pass'), { day: data.day }), onSuccess: refresh })

  let tone = 'bg-surface border-line'
  let title: ReactNode = null
  let sub: ReactNode = null
  let actions: ReactNode = null

  const passBtn = data.can_pass && (
    <Button variant="ghost" size="sm" onClick={() => window.confirm(t('banner.pass_confirm')) && pass.mutate()} loading={pass.isPending}>
      <Hand className="size-4" /> <span className="language-text">{t('banner.pass')}</span>
    </Button>
  )
  const adminWrite = data.can_write && !data.is_me_scribe && data.status !== 'published' && (
    <Button variant="secondary" size="sm" onClick={write} data-tour="write">
      <Pencil className="size-4" /> <span className="language-text">{t('banner.write_admin')}</span>
    </Button>
  )

  switch (data.status) {
    case 'no_school':
      tone = 'bg-azzurro-soft border-azzurro/20'
      title = <span className="language-text">{t('banner.no_school')}</span>
      sub = (
        <>
          {data.no_school_reason === 'weekend' ? <span className="language-text">{t('banner.weekend')}</span> : data.no_school_reason}
          {data.next_school_day && (
            <span className="mt-1 block">
              <span className="language-text">{t('banner.next_day', { day: shortDay(data.next_school_day.day, lang) })}</span>
              {data.next_school_day.scribe && <> · <TranslatedMessage message="banner.next_scribe" values={{ nick: data.next_school_day.scribe.nick }} /></>}
            </span>
          )}
        </>
      )
      break
    case 'published':
      tone = 'bg-verde-soft border-verde/30'
      title = <TranslatedMessage message="banner.published" values={{ nick: data.card?.author?.nick ?? nick, time: timeOf(data.card?.published_at, lang) }} />
      actions = data.can_write && (
        <Button variant="secondary" size="sm" onClick={write} data-tour="write">
          <Pencil className="size-4" /> <span className="language-text">{t('banner.edit')}</span>
        </Button>
      )
      break
    case 'draft':
      tone = 'bg-giallo-soft border-giallo/40'
      title = data.is_me_scribe ? <span className="language-text">{t('banner.me_draft')}</span> : <TranslatedMessage message="banner.draft" values={{ nick }} />
      sub = data.draft_updated_at ? <TranslatedMessage message="banner.draft_sub" values={{ time: timeOf(data.draft_updated_at, lang) }} /> : null
      if (data.is_me_scribe) sub = <>{sub} · <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
      actions = (
        <>
          {data.can_write && <Button onClick={write} data-tour="write"><span className="language-text">{data.is_me_scribe || data.has_draft ? t('banner.continue') : t('banner.write')}</span> <ArrowRight className="size-4" /></Button>}
          {passBtn}
        </>
      )
      break
    case 'open':
      tone = 'bg-rosa-soft border-rosa/25'
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
        tone = 'bg-bordeaux-soft border-bordeaux/20'
        title = <span className="language-text">{t('banner.me_not_started')}</span>
        sub = <><span className="language-text">{t('banner.me_sub')}</span> <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
        actions = (
          <>
            <Button size="lg" onClick={write} data-tour="write"><span className="language-text">{t('banner.write')}</span> <ArrowRight className="size-4" /></Button>
            {passBtn}
          </>
        )
      } else {
        title = data.override_reason === 'takeover'
          ? <TranslatedMessage message="banner.taken_over" values={{ nick }} />
          : <TranslatedMessage message="banner.not_started" values={{ nick }} />
        sub = <><span className="language-text">{t('banner.not_started_sub')}</span> <span className="language-text">{t('banner.takeover_hint', { time: data.takeover_at })}</span></>
        actions = adminWrite
      }
  }

  const error = takeover.error || pass.error
  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${tone}`} aria-live="polite">
      <div className="flex gap-3">
        {data.status === 'published' ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-verde text-white"><PartyPopper className="size-5" /></span>
        ) : data.scribe ? (
          <Avatar nick={data.scribe.nick} color={data.scribe.color} />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-snug">{title}</p>
          {sub && <p className="mt-1 text-sm text-ink/70">{sub}</p>}
        </div>
      </div>
      {data.open_corrections > 0 && data.can_write && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-giallo px-3 py-1 text-sm font-bold text-[#1d1b1e]">
          <TriangleAlert className="size-4" /> <span className="language-text">{t('feedback.open_corrections', { count: data.open_corrections })}</span>
        </p>
      )}
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      {error && <p className="mt-2 text-sm font-medium text-rosa-ink">{(error as Error).message}</p>}
    </section>
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
  const { t, i18n } = useTranslation()
  const today = useToday(info.code)
  if (today.isLoading) return <Spinner />
  if (today.error) return <ErrorBox error={today.error} onRetry={() => today.refetch()} />
  const data = today.data!
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-bordeaux"><span className="language-text">{t('nav.today')}</span></p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{capitalize(longDay(data.day, i18n.language))}</h1>
      </div>

      {info.is_demo && isWeekend(data.day) && <DemoWeekendNote />}

      <ScribeBanner data={data} />

      {data.is_school_day && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('today.lessons')}</span></h2>
          <LessonsStrip lessons={data.lessons} subjects={info.subjects} />
        </section>
      )}

      {data.card && data.status === 'published' && (
        <>
          <DayCardView card={data.card} subjects={info.subjects} classLabel={info.label} classInfo={info} canShare={info.viewer.can_manage || info.viewer.member?.id === data.card.author?.id} />
          <Feedback code={info.code} day={data.day} readOnly={info.viewer.read_only} />
        </>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('today.soon')}</span></h2>
          <Link to={`/c/${info.code}/in-arrivo`} className="text-sm font-semibold text-bordeaux hover:underline">
            <span className="language-text">{t('today.all_upcoming')}</span>
          </Link>
        </div>
        {data.upcoming_soon.length === 0 ? (
          <Card className="text-center text-muted"><span className="language-text">{t('today.soon_empty')}</span></Card>
        ) : (
          <div className="space-y-2">
            {data.upcoming_soon.map((it) => (
              <ItemRow key={it.id} item={it} subjects={info.subjects} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
