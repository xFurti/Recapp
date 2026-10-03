import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { api } from '../api'
import { EntryPhotos, LabBox } from '../components/day'
import { ItemRow } from '../components/items'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Segmented, Spinner } from '../components/ui'
import { capitalize, relativeDay, shortDay, subjectColor, subjectName } from '../lib/format'
import { classPath, useClass } from '../queries'
import type { SubjectEntryRow } from '../types'

type Range = 'week' | '2weeks' | 'all'

export function SubjectChips({ active }: { active?: string }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  return (
    <nav aria-label={t('subject.by_subject')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {info.subjects.map((s) => (
        <Link
          key={s.code}
          to={`/c/${info.code}/materia/${s.code}`}
          aria-current={active === s.code ? 'page' : undefined}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
            active === s.code ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink/40'
          }`}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
          {subjectName(info.subjects, s.code, i18n.language)}
        </Link>
      ))}
    </nav>
  )
}

export default function SubjectPage() {
  const info = useClass()
  const { subject = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [range, setRange] = useState<Range>('2weeks')
  const rows = useQuery({
    queryKey: ['subject', info.code, subject, range],
    queryFn: () => api.get<SubjectEntryRow[]>(classPath(info.code, `/subjects/${subject}/entries?range=${range}`)),
  })
  const color = subjectColor(info.subjects, subject)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-bordeaux">{t('subject.by_subject')}</p>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="size-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {subjectName(info.subjects, subject, lang)}
        </h1>
      </div>
      <SubjectChips active={subject} />
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: t('subject.week') },
          { value: '2weeks', label: t('subject.two_weeks') },
          { value: 'all', label: t('subject.all') },
        ]}
      />
      {rows.isLoading && <Spinner />}
      {rows.error && <ErrorBox error={rows.error} onRetry={() => rows.refetch()} />}
      {rows.data?.length === 0 && (
        <Card>
          <EmptyState title={t('subject.empty')} />
        </Card>
      )}
      <ol className="space-y-3">
        {rows.data?.map((r, i) => (
          <li key={`${r.day}-${i}`} className="overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderLeftColor: color, borderLeftWidth: 5 }}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {relativeDay(r.day, t, lang)}
                  <span className="ml-2 font-medium text-muted">{capitalize(shortDay(r.day, lang))}</span>
                </p>
                <p className="text-xs text-muted">
                  {[r.hours && (r.hours.includes('-') ? t('day.hours', { h: r.hours }) : t('day.hour', { h: r.hours })), r.author && t('day.by', { nick: r.author.nick })]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {r.is_lab && <Badge className="bg-verde-soft text-verde-ink">{t('day.lab')} {r.room}</Badge>}
              {r.author && <Avatar nick={r.author.nick} color={r.author.color} size="sm" />}
            </div>
            <div className="px-4 py-3">
              {r.lesson_status !== 'svolta' && <Badge className="mb-2 bg-giallo-soft text-ink">{t(`day.status_${r.lesson_status}`)}</Badge>}
              {r.bullets.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed marker:text-muted">
                  {r.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : (
                r.lesson_status === 'svolta' && <p className="text-sm text-muted">{t('day.nothing_written')}</p>
              )}
              <EntryPhotos ids={r.attachment_ids} />
              <LabBox entry={r} />
              {r.items.length > 0 && (
                <div className="mt-3 space-y-2">
                  {r.items.map((it) => (
                    <ItemRow key={it.id} item={it} subjects={info.subjects} compact />
                  ))}
                </div>
              )}
              <Link to={`/c/${info.code}/giorno/${r.day}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-bordeaux hover:underline">
                {t('subject.open_day')} <ArrowRight className="size-4" />
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
