import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Hand, Pencil, PartyPopper } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { DayCardView, LessonsStrip } from '../components/day'
import { ItemRow } from '../components/items'
import { Avatar, Button, Card, ErrorBox, Spinner } from '../components/ui'
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
  const bold = { b: <strong className="font-extrabold" /> }
  const write = () => navigate(`/c/${info.code}/scrivi/${data.day}`)
  const refresh = () => qc.invalidateQueries({ queryKey: ['today', info.code] })

  const takeover = useMutation({ mutationFn: () => api.post(classPath(info.code, '/today/takeover'), { day: data.day }), onSuccess: refresh })
  const pass = useMutation({ mutationFn: () => api.post(classPath(info.code, '/today/pass'), { day: data.day }), onSuccess: refresh })

  let tone = 'bg-white border-line'
  let title: ReactNode = null
  let sub: ReactNode = null
  let actions: ReactNode = null

  const passBtn = data.can_pass && (
    <Button variant="ghost" size="sm" onClick={() => window.confirm(t('banner.pass_confirm')) && pass.mutate()} loading={pass.isPending}>
      <Hand className="size-4" /> {t('banner.pass')}
    </Button>
  )
  const adminWrite = data.can_write && !data.is_me_scribe && data.status !== 'published' && (
    <Button variant="secondary" size="sm" onClick={write}>
      <Pencil className="size-4" /> {t('banner.write_admin')}
    </Button>
  )

  switch (data.status) {
    case 'no_school':
      tone = 'bg-azzurro-soft border-azzurro/20'
      title = t('banner.no_school')
      sub = (
        <>
          {data.no_school_reason === 'weekend' ? t('banner.weekend') : data.no_school_reason}
          {data.next_school_day && (
            <span className="mt-1 block">
              {t('banner.next_day', { day: shortDay(data.next_school_day.day, lang) })}
              {data.next_school_day.scribe && ` · ${t('banner.next_scribe', { nick: data.next_school_day.scribe.nick })}`}
            </span>
          )}
        </>
      )
      break
    case 'published':
      tone = 'bg-verde-soft border-verde/30'
      title = <Trans i18nKey="banner.published" values={{ nick: data.card?.author?.nick ?? nick, time: timeOf(data.card?.published_at, lang) }} components={bold} />
      actions = data.can_write && (
        <Button variant="secondary" size="sm" onClick={write}>
          <Pencil className="size-4" /> {t('banner.edit')}
        </Button>
      )
      break
    case 'draft':
      tone = 'bg-giallo-soft border-giallo/40'
      title = data.is_me_scribe ? t('banner.me_draft') : <Trans i18nKey="banner.draft" values={{ nick }} components={bold} />
      sub = data.draft_updated_at ? t('banner.draft_sub', { time: timeOf(data.draft_updated_at, lang) }) : null
      if (data.is_me_scribe) sub = <>{sub} · {t('banner.takeover_hint', { time: data.takeover_at })}</>
      actions = (
        <>
          {data.can_write && <Button onClick={write}>{data.is_me_scribe || data.has_draft ? t('banner.continue') : t('banner.write')} <ArrowRight className="size-4" /></Button>}
          {passBtn}
        </>
      )
      break
    case 'open':
      tone = 'bg-rosa-soft border-rosa/25'
      if (data.is_me_scribe) {
        title = t('banner.me_open')
        actions = <Button onClick={write}>{data.has_draft ? t('banner.continue') : t('banner.write')} <ArrowRight className="size-4" /></Button>
      } else {
        title = data.scribe
          ? <Trans i18nKey="banner.open_missing" values={{ nick }} components={bold} />
          : data.override_reason === 'pass' ? t('banner.open_pass') : t('banner.open_nobody')
        sub = t('banner.open_sub')
        actions = (
          <>
            {data.can_takeover && (
              <Button onClick={() => takeover.mutate(undefined, { onSuccess: write })} loading={takeover.isPending}>
                <Hand className="size-4" /> {t('banner.takeover')}
              </Button>
            )}
            {adminWrite}
          </>
        )
      }
      break
    case 'future':
      title = t('banner.future')
      break
    default:
      if (data.is_me_scribe) {
        tone = 'bg-bordeaux-soft border-bordeaux/20'
        title = t('banner.me_not_started')
        sub = <>{t('banner.me_sub')} {t('banner.takeover_hint', { time: data.takeover_at })}</>
        actions = (
          <>
            <Button size="lg" onClick={write}>{t('banner.write')} <ArrowRight className="size-4" /></Button>
            {passBtn}
          </>
        )
      } else {
        title = data.override_reason === 'takeover'
          ? <Trans i18nKey="banner.taken_over" values={{ nick }} components={bold} />
          : <Trans i18nKey="banner.not_started" values={{ nick }} components={bold} />
        sub = <>{t('banner.not_started_sub')} {t('banner.takeover_hint', { time: data.takeover_at })}</>
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
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      {error && <p className="mt-2 text-sm font-medium text-rosa-ink">{(error as Error).message}</p>}
    </section>
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
        <p className="text-sm font-semibold uppercase tracking-wide text-bordeaux">{t('nav.today')}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{capitalize(longDay(data.day, i18n.language))}</h1>
      </div>

      <ScribeBanner data={data} />

      {data.is_school_day && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t('today.lessons')}</h2>
          <LessonsStrip lessons={data.lessons} subjects={info.subjects} />
        </section>
      )}

      {data.card && data.status === 'published' && <DayCardView card={data.card} subjects={info.subjects} classLabel={info.label} />}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t('today.soon')}</h2>
          <Link to={`/c/${info.code}/in-arrivo`} className="text-sm font-semibold text-bordeaux hover:underline">
            {t('today.all_upcoming')}
          </Link>
        </div>
        {data.upcoming_soon.length === 0 ? (
          <Card className="text-center text-muted">{t('today.soon_empty')}</Card>
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
