import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { api } from '../api'
import { EntryPhotos, LabBox } from '../components/day'
import { ItemRow } from '../components/items'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Segmented, Spinner, useDismiss } from '../components/ui'
import { capitalize, relativeDay, shortDay, subjectColor, subjectName } from '../lib/format'
import { classPath, useClass } from '../queries'
import type { SubjectEntryRow } from '../types'

type Range = 'week' | '2weeks' | 'all'

const RETURN_SCROLL = 'recapp.return-scroll'

type ReturnState = { from?: string }

/** Where "all subjects" sends you: the page you came from, or Ieri for a direct link. */
export function subjectReturnPath(code: string, from?: string) {
  const base = `/c/${code}`
  if (from?.startsWith(base) && !from.includes('/materia/')) return from
  return `${base}/ieri`
}

function originPath(pathname: string, state: unknown) {
  if (pathname.includes('/materia/')) return (state as ReturnState | null)?.from
  return pathname
}

function rememberScroll(pathname: string) {
  if (pathname.includes('/materia/')) return
  try {
    sessionStorage.setItem(RETURN_SCROLL, JSON.stringify({ path: pathname, y: window.scrollY }))
  } catch {
    /* private mode */
  }
}

/** Puts the originating page back where it was after leaving a subject. */
export function useRestoreReturnScroll() {
  const { pathname } = useLocation()
  useEffect(() => {
    let saved: { path?: string; y?: number } | null = null
    try {
      saved = JSON.parse(sessionStorage.getItem(RETURN_SCROLL) ?? 'null')
    } catch {
      saved = null
    }
    if (!saved || saved.path !== pathname || typeof saved.y !== 'number') return
    sessionStorage.removeItem(RETURN_SCROLL)
    const y = saved.y
    requestAnimationFrame(() => window.scrollTo(0, y))
  }, [pathname])
}

export function SubjectMenu({ active }: { active?: string }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const from = originPath(location.pathname, location.state)
  const backTo = subjectReturnPath(info.code, from)
  const current = info.subjects.find((s) => s.code === active)
  const label = current ? subjectName(info.subjects, current.code, i18n.language) : t('subject.by_subject')
  const option = `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold`
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold hover:border-ink/30"
      >
        <span className="size-2 rounded-full" style={{ backgroundColor: current?.color ?? 'var(--color-line)' }} aria-hidden />
        {label}
        <ChevronDown className={`size-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label={t('subject.by_subject')} className="absolute z-20 mt-2 max-h-80 w-64 overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          <li>
            {active ? (
              <Link to={backTo} role="option" aria-selected={false} onClick={close} className={`${option} hover:bg-ink/5`}>
                <span className="size-2 rounded-full border border-current" aria-hidden />
                <span className="language-text">{t('subject.all_subjects')}</span>
              </Link>
            ) : (
              <button type="button" role="option" aria-selected onClick={close} className={`${option} bg-ink text-paper`}>
                <span className="size-2 rounded-full border border-current" aria-hidden />
                <span className="language-text">{t('subject.all_subjects')}</span>
              </button>
            )}
          </li>
          {info.subjects.map((s) => (
            <li key={s.code}>
              <Link
                to={`/c/${info.code}/materia/${s.code}`}
                state={{ from } satisfies ReturnState}
                role="option"
                aria-selected={active === s.code}
                onClick={() => {
                  rememberScroll(location.pathname)
                  close()
                }}
                className={`${option} ${active === s.code ? 'bg-ink text-paper' : 'hover:bg-ink/5'}`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                {subjectName(info.subjects, s.code, i18n.language)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const location = useLocation()
  const backTo = subjectReturnPath(info.code, originPath(location.pathname, location.state))
  const color = subjectColor(info.subjects, subject)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-bordeaux"><span className="language-text">{t('subject.by_subject')}</span></p>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="size-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {subjectName(info.subjects, subject, lang)}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={backTo} className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> <span className="language-text">{t('subject.back_general')}</span>
        </Link>
        <SubjectMenu active={subject} />
      </div>
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
              {r.is_lab && <Badge className="bg-verde-soft text-verde-ink"><span className="language-text">{t('day.lab')}</span> {r.room}</Badge>}
              {r.author && <Avatar nick={r.author.nick} color={r.author.color} size="sm" />}
            </div>
            <div className="px-4 py-3">
              {r.lesson_status !== 'svolta' && <Badge className="mb-2 bg-giallo-soft text-ink"><span className="language-text">{t(`day.status_${r.lesson_status}`)}</span></Badge>}
              {r.bullets.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed marker:text-muted">
                  {r.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : (
                r.lesson_status === 'svolta' && <p className="text-sm text-muted"><span className="language-text">{t('day.nothing_written')}</span></p>
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
                <span className="language-text">{t('subject.open_day')}</span> <ArrowRight className="size-4" />
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
