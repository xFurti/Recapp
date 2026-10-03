import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FlaskConical, List } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { api } from '../api'
import { DayCardView } from '../components/day'
import { Feedback } from '../components/Feedback'
import { SubjectTag } from '../components/items'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Spinner } from '../components/ui'
import { todayIso } from '../lib/clock'
import { capitalize, longDay, relativeDay, shortDay } from '../lib/format'
import { classPath, useClass } from '../queries'
import type { CardPage, CardSummary } from '../types'
import { SubjectChips } from './SubjectPage'

function DayView({ day }: { day: string }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const page = useQuery({ queryKey: ['card', info.code, day], queryFn: () => api.get<CardPage>(classPath(info.code, `/cards/${day}`)) })
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
        <Link to={`${base}/giorni`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <List className="size-4" /> {t('day.all_days')}
        </Link>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{t('subject.by_subject')}</p>
        <SubjectChips />
      </div>
      {data.card && data.card.status === 'published' ? (
        <>
          <DayCardView card={data.card} subjects={info.subjects} classLabel={info.label} classInfo={info} canShare={info.viewer.can_manage || info.viewer.member?.id === data.card.author?.id} />
          <Feedback code={info.code} day={day} readOnly={info.viewer.read_only} />
        </>
      ) : (
        <Card>
          <EmptyState title={t('day.no_card')} />
        </Card>
      )}
    </div>
  )
}

function DayArrow({ to, label, dir }: { to: string | null; label: string; dir: 'prev' | 'next' }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  const cls = 'flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface'
  if (!to) return <span className={`${cls} opacity-30`} aria-hidden><Icon className="size-5" /></span>
  return (
    <Link to={to} className={`${cls} hover:border-ink/30`} aria-label={label} title={label}>
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

export function DaysList() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const list = useQuery({ queryKey: ['cards', info.code], queryFn: () => api.get<CardSummary[]>(classPath(info.code, '/cards')) })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">{t('day.days_title')}</h1>
      <SubjectChips />
      {list.isLoading && <Spinner />}
      {list.error && <ErrorBox error={list.error} />}
      {list.data?.length === 0 && (
        <Card>
          <EmptyState title={t('day.days_empty')} />
        </Card>
      )}
      <ul className="space-y-2">
        {list.data?.map((c) => (
          <li key={c.day}>
            <Link to={`/c/${info.code}/giorno/${c.day}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-ink/30">
              <div className="w-16 shrink-0 text-center">
                <p className="text-xs font-semibold uppercase text-muted">{shortDay(c.day, i18n.language).split(' ')[0]}</p>
                <p className="text-2xl font-extrabold leading-none">{Number(c.day.slice(8, 10))}</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {c.subjects.map((s, i) => (
                    <SubjectTag key={`${s}-${i}`} subjects={info.subjects} code={s} />
                  ))}
                  {c.has_lab && (
                    <Badge className="bg-verde-soft text-verde-ink">
                      <FlaskConical className="size-3" /> {t('day.lab')}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.author && t('day.by', { nick: c.author.nick })}
                  {c.items > 0 && ` · ${t('day.n_items', { count: c.items })}`}
                </p>
              </div>
              {c.author && <Avatar nick={c.author.nick} color={c.author.color} size="sm" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
