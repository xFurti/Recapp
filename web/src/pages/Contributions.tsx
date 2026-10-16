import { ArrowLeft, ChevronDown, Info, LocateFixed, Trophy } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StreakDays, StreakHeadline, StreakLegend, StreakNote } from '../components/contributions'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Spinner } from '../components/ui'
import { parseDay } from '../lib/clock'
import { locale } from '../lib/format'
import { useClass, useContributions } from '../queries'
import type { ContributionRow, ContributionsInfo } from '../types'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function usePosition() {
  const { t } = useTranslation()
  return (row: ContributionRow) => t('contributions.position', { count: row.position, ordinal: true })
}

function Row({ row, ranked }: { row: ContributionRow; ranked: boolean }) {
  const { t } = useTranslation()
  const position = usePosition()
  const first = ranked && row.position === 1
  return (
    <li
      id={row.is_me ? 'contributions-me' : undefined}
      tabIndex={row.is_me ? -1 : undefined}
      aria-current={row.is_me ? 'true' : undefined}
      className={`flex items-center gap-3 px-3 py-3 outline-offset-[-3px] sm:px-4 ${row.is_me ? 'bg-bordeaux-soft' : ''}`}
      data-me={row.is_me || undefined}
    >
      {ranked && (
        <div className="w-12 shrink-0 text-center sm:w-16">
          <p className="text-lg font-extrabold tabular-nums leading-tight"><span className="language-text">{position(row)}</span></p>
          {row.tied && <p className="text-[11px] font-semibold leading-tight text-muted"><span className="language-text">{t('contributions.tied')}</span></p>}
        </div>
      )}
      <Avatar nick={row.member.nick} color={row.member.color} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold">
          <span className="min-w-0 break-words">{row.member.nick}</span>
          {row.is_me && <span className="text-xs font-medium text-muted">(<span className="language-text">{t('common.you')}</span>)</span>}
          {first && (
            <Badge className="bg-giallo text-[#1d1b1e]">
              <Trophy className="size-3" aria-hidden /> <span className="language-text">{t(row.tied ? 'contributions.first_tied' : 'contributions.first')}</span>
            </Badge>
          )}
        </p>
        <p className="flex flex-wrap gap-x-1.5 text-xs text-muted">
          <span className="whitespace-nowrap"><span className="language-text">{t('contributions.days', { count: row.days_published })}</span><span aria-hidden> ·</span></span>
          <span className="whitespace-nowrap"><span className="language-text">{t('contributions.items', { count: row.items_added })}</span></span>
        </p>
      </div>
      <p className="shrink-0 text-right">
        <span className="block text-lg font-extrabold tabular-nums leading-tight">{row.thanks}</span>
        <span className="language-text block text-xs font-semibold text-muted">{t('contributions.thanks_label', { count: row.thanks })}</span>
      </p>
    </li>
  )
}

function Rules({ period }: { period: ContributionsInfo['period'] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const id = useId()
  const rules = ['thanks', 'period', 'credit', 'order', 'streak', 'members'] as const
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <h2>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-bold hover:bg-ink/5 sm:px-5">
          <Info className="size-5 shrink-0 text-bordeaux" aria-hidden />
          <span className="language-text flex-1">{t('contributions.rules_title')}</span>
          <ChevronDown className={`faq-chevron size-5 shrink-0 text-muted ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </h2>
      <div id={id} className="faq-answer" data-open={open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <ul className="list-disc space-y-2 px-4 pb-4 pl-9 text-sm leading-relaxed text-muted marker:text-bordeaux sm:px-5 sm:pl-10">
            {rules.map((rule) => <li key={rule}><span className="language-text">{t(`contributions.rule_${rule}`, { label: period.label })}</span></li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}

function MyPosition({ row, allZero }: { row: ContributionRow; allZero: boolean }) {
  const { t } = useTranslation()
  const position = usePosition()
  const go = () => {
    const target = document.getElementById('contributions-me')
    if (!target) return
    target.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    target.focus({ preventScroll: true })
  }
  return (
    <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 border-bordeaux/30">
      <Avatar nick={row.member.nick} color={row.member.color} />
      <div className="min-w-[11rem] flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('contributions.me')}</span></p>
        <p className="font-bold">
          {allZero ? (
            <span className="language-text">{t('contributions.me_unranked', { count: row.thanks })}</span>
          ) : (
            <>
              <span className="language-text">{position(row)}</span>
              {row.tied && <> <span className="language-text">{t('contributions.tied')}</span></>}
              {' · '}<span className="language-text">{t('contributions.thanks', { count: row.thanks })}</span>
            </>
          )}
        </p>
      </div>
      <button type="button" onClick={go} className="-ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-bordeaux hover:bg-bordeaux-soft sm:ml-0">
        <LocateFixed className="size-4" aria-hidden /> <span className="language-text">{t('contributions.go_to_me')}</span>
      </button>
    </Card>
  )
}

export default function ContributionsPage() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const data = useContributions(info.code)
  const heading = useRef<HTMLHeadingElement>(null)

  // Classe and Contributi share one section: move focus like a page change does.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const dates = new Intl.DateTimeFormat(locale(i18n.language), { day: 'numeric', month: 'long', year: 'numeric' })
  const body = (() => {
    if (data.isLoading) return <Spinner />
    if (data.error) return <ErrorBox error={data.error} onRetry={() => data.refetch()} />
    const { streak, ranking, totals, period } = data.data!
    const allZero = totals.thanks === 0
    const nothing = totals.thanks === 0 && totals.days_published === 0 && totals.items_added === 0
    const me = ranking.find((row) => row.is_me)
    const seen = new Set(streak.days.map((d) => d.status))
    return (
      <div className="space-y-5">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge className="bg-bordeaux-soft text-bordeaux"><span className="language-text">{t('contributions.period', { label: period.label })}</span></Badge>
          <span className="text-muted"><span className="language-text">{t('contributions.period_range', { start: dates.format(parseDay(period.start)), end: dates.format(parseDay(period.end)) })}</span></span>
        </p>

        <Card className="space-y-3">
          <StreakHeadline streak={streak} />
          <StreakDays streak={streak} />
          <StreakNote streak={streak} />
          {streak.days.length > 0 && <StreakLegend statuses={(['published', 'late', 'missed', 'today_open'] as const).filter((s) => seen.has(s) || s !== 'today_open')} />}
        </Card>

        {nothing ? (
          <Card>
            <EmptyState title={t('contributions.empty_title')} text={t('contributions.empty_text')} />
          </Card>
        ) : (
          <>
            {me && <MyPosition row={me} allZero={allZero} />}
            <section aria-labelledby="ranking-title">
              <h2 id="ranking-title" className="mb-2 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('contributions.ranking_title')}</span></h2>
              {allZero && (
                <div role="note" className="mb-3 rounded-2xl border border-line bg-surface p-4">
                  <p className="font-semibold"><span className="language-text">{t('contributions.all_zero_title')}</span></p>
                  <p className="mt-0.5 text-sm text-muted"><span className="language-text">{t('contributions.all_zero_text')}</span></p>
                </div>
              )}
              {/* With no Grazie at all nobody is ranked: an alphabetical list, no positions. */}
              {(() => {
                const List = allZero ? 'ul' : 'ol'
                return (
                  <List className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                    {ranking.map((row) => <Row key={row.member.id} row={row} ranked={!allZero} />)}
                  </List>
                )
              })()}
            </section>
          </>
        )}

        <Rules period={period} />
      </div>
    )
  })()

  return (
    <div>
      <Link to={`/c/${info.code}/classe`} state={{ focus: 'contributions' }} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> <span className="language-text">{t('contributions.back')}</span>
      </Link>
      <h1 ref={heading} tabIndex={-1} data-page-focus="" className="text-2xl font-extrabold tracking-tight"><span className="language-text">{t('contributions.title')}</span></h1>
      <p className="mb-4 mt-1 max-w-prose text-muted"><span className="language-text">{t('contributions.intro')}</span></p>
      {body}
    </div>
  )
}
