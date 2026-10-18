import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { ArchiveControls, ArchivePagination } from '../components/ArchiveControls'
import { EntryPhotos, LabBox } from '../components/day'
import { ItemRow } from '../components/items'
import { TranslatedMessage } from '../components/TranslatedMessage'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Spinner, useDismiss } from '../components/ui'
import { archiveSubjectSearch, useArchive, type ArchiveReturnState } from '../lib/archive'
import { capitalize, shortDay, subjectColor, subjectName } from '../lib/format'
import { useClass } from '../queries'
import type { SubjectEntryRow } from '../types'

const RETURN_SCROLL = 'recapp.return-scroll'

/** Where "all subjects" sends you: the page you came from, or Ieri for a direct link. */
export function subjectReturnPath(code: string, from?: string) {
  const base = `/c/${code}`
  if ((from === base || from?.startsWith(`${base}/`)) && !from?.includes('/materia/')) return from
  return `${base}/ieri`
}

function originPath(pathname: string, search: string, state: unknown) {
  if (pathname.includes('/materia/')) return (state as ArchiveReturnState | null)?.from
  return pathname + search
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
export function useRestoreReturnScroll(ready = true) {
  const { pathname, search } = useLocation()
  useEffect(() => {
    if (!ready) return
    let saved: { path?: string; y?: number } | null = null
    try {
      saved = JSON.parse(sessionStorage.getItem(RETURN_SCROLL) ?? 'null')
    } catch {
      saved = null
    }
    if (!saved || saved.path !== pathname + search || typeof saved.y !== 'number') return
    sessionStorage.removeItem(RETURN_SCROLL)
    const y = saved.y
    requestAnimationFrame(() => window.scrollTo(0, y))
  }, [pathname, search, ready])
}

export function SubjectMenu({ active }: { active?: string }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const from = originPath(location.pathname, location.search, location.state)
  const subjectSearch = archiveSubjectSearch(location.pathname.includes('/giorno/') ? (location.state as ArchiveReturnState | null)?.archiveFrom ?? location.pathname : location.pathname + location.search)
  const backTo = subjectReturnPath(info.code, from)
  const current = info.subjects.find((s) => s.code === active)
  const label = current ? subjectName(info.subjects, current.code, i18n.language) : t('subject.by_subject')
  const option = `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold`
  return (
    <div className="relative min-w-0 max-w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold hover:border-ink/30"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: current?.color ?? 'var(--color-line)' }} aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label={t('subject.by_subject')} className="absolute z-20 mt-2 max-h-80 w-64 overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          <li>
            {active ? (
              <Link to={backTo} state={{ archiveFrom: (location.state as ArchiveReturnState | null)?.archiveFrom }} role="option" aria-selected={false} onClick={close} className={`${option} hover:bg-ink/5`}>
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
                to={`/c/${info.code}/materia/${s.code}${subjectSearch}`}
                state={{ from, archiveFrom: (location.state as ArchiveReturnState | null)?.archiveFrom } satisfies ArchiveReturnState}
                role="option"
                aria-selected={active === s.code}
                onClick={() => {
                  rememberScroll(location.pathname + location.search)
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
  const rows = useArchive<SubjectEntryRow>('subject', `/subjects/${encodeURIComponent(subject)}/entries`, '2weeks')
  const location = useLocation()
  const backTo = subjectReturnPath(info.code, originPath(location.pathname, location.search, location.state))
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
        <Link to={backTo} state={{ archiveFrom: (location.state as ArchiveReturnState | null)?.archiveFrom }} className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> <span className="language-text">{t('subject.back_general')}</span>
        </Link>
        <SubjectMenu active={subject} />
      </div>
      <ArchiveControls fallback="2weeks" />
      {rows.isLoading && <Spinner />}
      {rows.error && !rows.data && <ErrorBox error={rows.error} onRetry={() => rows.refetch()} />}
      {rows.data && rows.results.length === 0 && (
        <Card>
          <EmptyState title={t('subject.empty')} />
        </Card>
      )}
      <ol aria-label={t('archive.subject_results')} className="space-y-3">
        {rows.results.map((r) => (
          <li key={r.id} className="overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderLeftColor: color, borderLeftWidth: 5 }}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {capitalize(shortDay(r.day, lang))} <span className="font-medium text-muted">{r.day.slice(0, 4)}</span>
                </p>
                <p className="text-xs text-muted">
                  {[r.hours && (r.hours.includes('-') ? t('day.hours', { h: r.hours }) : t('day.hour', { h: r.hours })), r.author && t('day.by', { nick: r.author.nick })]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.updated_by && <p className="text-xs text-muted"><TranslatedMessage message="day.updated_by" values={{ nick: r.updated_by.nick }} /></p>}
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
              <Link to={`/c/${info.code}/giorno/${r.day}`} state={{ archiveFrom: location.pathname + location.search, from: (location.state as ArchiveReturnState | null)?.from }} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-bordeaux hover:underline">
                <span className="language-text">{t('subject.open_day')}</span> <ArrowRight className="size-4" />
              </Link>
            </div>
          </li>
        ))}
      </ol>
      {rows.data && <ArchivePagination count={rows.results.length} hasMore={rows.hasMore} loading={rows.isFetching || rows.restoring} error={rows.error} onMore={rows.loadMore} />}
    </div>
  )
}
