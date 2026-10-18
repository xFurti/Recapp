import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FlaskConical, List, PenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { DayCardView } from '../components/day'
import { Feedback } from '../components/Feedback'
import { ArchiveControls, ArchivePagination } from '../components/ArchiveControls'
import { TranslatedMessage } from '../components/TranslatedMessage'
import { SubjectTag } from '../components/items'
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Spinner } from '../components/ui'
import { parseDay, todayIso } from '../lib/clock'
import { useArchive, type ArchiveReturnState } from '../lib/archive'
import { capitalize, locale, longDay, relativeDay, shortDay } from '../lib/format'
import { classPath, useClass } from '../queries'
import type { CardPage, CardSummary } from '../types'
import { SubjectMenu, useRestoreReturnScroll } from './SubjectPage'

function DayView({ day }: { day: string }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const archiveFrom = (location.state as ArchiveReturnState | null)?.archiveFrom
  const returnTo = archiveFrom?.startsWith(`/c/${info.code}/`) ? archiveFrom : null
  const page = useQuery({ queryKey: ['card', info.code, day], queryFn: () => api.get<CardPage>(classPath(info.code, `/cards/${day}`)) })
  useRestoreReturnScroll(!!page.data)
  const base = `/c/${info.code}`
  if (page.isLoading) return <Spinner />
  if (page.error) return <ErrorBox error={page.error} onRetry={() => page.refetch()} />
  const data = page.data!
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DayArrow to={data.prev_published ? `${base}/giorno/${data.prev_published}` : null} label={t('day.prev')} dir="prev" />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-bordeaux">{relativeDay(day, t, i18n.language)}</p>
          <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{capitalize(longDay(day, i18n.language))}</h1>
        </div>
        <DayArrow to={data.next_published ? `${base}/giorno/${data.next_published}` : null} label={t('day.next')} dir="next" />
      </div>
      <div className="flex justify-center">
        <Link to={returnTo ?? `${base}/giorni`} state={{ from: (location.state as ArchiveReturnState | null)?.from }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <List className="size-4" /> <span className="language-text">{t(returnTo ? 'archive.back_results' : 'day.all_days')}</span>
        </Link>
      </div>
      <SubjectMenu />
      {data.card && data.card.status === 'published' ? (
        <>
          <DayCardView card={data.card} subjects={info.subjects} classLabel={info.label} classInfo={info} canShare={info.viewer.can_manage || info.viewer.member?.id === data.card.author?.id} />
          <Feedback code={info.code} day={day} readOnly={info.viewer.read_only} />
        </>
      ) : data.state.is_school_day && day < todayIso() ? (
        <Card>
          <EmptyState
            title={t('day.missed_title')}
            text={data.state.has_draft ? t('day.missed_draft_sub') : t('day.missed_sub')}
          >
            {data.state.can_write && <RecoverButton day={day} hasDraft={data.state.has_draft} />}
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <EmptyState title={t('day.no_card')} />
        </Card>
      )}
    </div>
  )
}

/** Opens the editor on a past day nobody published, resuming its draft if there is one. */
function RecoverButton({ day, hasDraft, size = 'md' }: { day: string; hasDraft: boolean; size?: 'sm' | 'md' }) {
  const info = useClass()
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Button size={size} onClick={() => navigate(`/c/${info.code}/scrivi/${day}`)}>
      <PenLine className="size-4" aria-hidden />
      <span className="language-text">{hasDraft ? t('day.complete_draft') : t('day.fill_day')}</span>
    </Button>
  )
}

function DayArrow({ to, label, dir }: { to: string | null; label: string; dir: 'prev' | 'next' }) {
  const location = useLocation()
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  const cls = 'flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface'
  if (!to) return <span className={`${cls} opacity-30`} aria-hidden><Icon className="size-5" /></span>
  return (
    <Link to={to} state={location.state} className={`${cls} hover:border-ink/30`} aria-label={label} title={label}>
      <Icon className="size-5" />
    </Link>
  )
}

export function Yesterday() {
  const info = useClass()
  const { t } = useTranslation()
  const latest = useQuery({
    queryKey: ['latest', info.code, todayIso()],
    queryFn: () => api.get<{ day: string | null }>(classPath(info.code, '/latest')),
  })
  if (latest.isLoading) return <Spinner />
  if (latest.error) return <ErrorBox error={latest.error} />
  if (!latest.data?.day) {
    return (
      <Card>
        <EmptyState title={t('day.empty_yesterday')} text={t('day.empty_yesterday_sub')} />
      </Card>
    )
  }
  return <DayView day={latest.data.day} />
}

export function DayByDate() {
  const { day = '' } = useParams()
  return <DayView key={day} day={day} />
}

function ArchiveDate({ day, lang }: { day: string; lang: string }) {
  return (
    <time dateTime={day} className="w-16 shrink-0 text-center">
      <span className="block text-xs font-semibold uppercase text-muted">{shortDay(day, lang).split(' ')[0]}</span>
      <span className="block text-2xl font-extrabold leading-none">{Number(day.slice(8, 10))}</span>
      <span className="mt-1 block text-[10px] font-semibold text-muted">{new Intl.DateTimeFormat(locale(lang), { month: 'short', year: 'numeric' }).format(parseDay(day))}</span>
    </time>
  )
}

export function DaysList() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const list = useArchive<CardSummary>('cards', '/cards', 'all')
  const location = useLocation()
  const dayState = { archiveFrom: location.pathname + location.search }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight"><span className="language-text">{t('day.days_title')}</span></h1>
      <SubjectMenu />
      <ArchiveControls fallback="all" />
      {list.isLoading && <Spinner />}
      {list.error && !list.data && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.results.length === 0 && (
        <Card>
          <EmptyState title={t('archive.empty')} />
        </Card>
      )}
      <ul aria-label={t('archive.day_results')} className="space-y-2">
        {list.results.map((c) => c.missing ? (
          <li key={c.day} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-dashed border-line bg-surface/60 p-3">
            <Link to={`/c/${info.code}/giorno/${c.day}`} state={dayState} className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
              <ArchiveDate day={c.day} lang={i18n.language} />
              <div className="min-w-0 flex-1">
                <Badge className="bg-rosa-soft text-rosa-ink">
                  <span className="language-text">{c.has_draft ? t('day.draft_badge') : t('day.missed_badge')}</span>
                </Badge>
                <p className="language-text mt-1 text-sm text-muted">{t('day.missed_title')}</p>
              </div>
            </Link>
            {c.can_write && <div className="ml-auto"><RecoverButton day={c.day} hasDraft={!!c.has_draft} size="sm" /></div>}
          </li>
        ) : (
          <li key={c.day}>
            <Link to={`/c/${info.code}/giorno/${c.day}`} state={dayState} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-ink/30">
              <ArchiveDate day={c.day} lang={i18n.language} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {c.subjects.map((s, i) => (
                    <SubjectTag key={`${s}-${i}`} subjects={info.subjects} code={s} />
                  ))}
                  {c.has_lab && (
                    <Badge className="bg-verde-soft text-verde-ink">
                      <FlaskConical className="size-3" /> <span className="language-text">{t('day.lab')}</span>
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.author && t('day.by', { nick: c.author.nick })}
                  {c.items > 0 && ` · ${t('day.n_items', { count: c.items })}`}
                </p>
                {c.updated_by && <p className="text-sm text-muted"><TranslatedMessage message="day.updated_by" values={{ nick: c.updated_by.nick }} /></p>}
              </div>
              {c.author && <Avatar nick={c.author.nick} color={c.author.color} size="sm" />}
            </Link>
          </li>
        ))}
      </ul>
      {list.data && <ArchivePagination count={list.results.length} hasMore={list.hasMore} loading={list.isFetching || list.restoring} error={list.error} onMore={list.loadMore} />}
    </div>
  )
}
