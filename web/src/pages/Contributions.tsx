import { ArrowLeft, ArrowUpRight, ChevronDown, Crown, Heart, Info, LocateFixed, Medal, Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StreakDays, StreakHeadline, StreakLegend, StreakNote, StreakPanel } from '../components/contributions'
import { ContributionCount } from '../components/ContributionCount'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Spinner } from '../components/ui'
import { parseDay } from '../lib/clock'
import { locale } from '../lib/format'
import { useRankingMotion } from '../lib/contribution-motion'
import { useClass, useContributions } from '../queries'
import type { ContributionRow, ContributionsInfo } from '../types'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function usePosition() {
  const { t } = useTranslation()
  return (row: ContributionRow) => t('contributions.position', { count: row.position, ordinal: true })
}

function Row({ row, ranked, podium = false, index = 0 }: { row: ContributionRow; ranked: boolean; podium?: boolean; index?: number }) {
  const { t } = useTranslation()
  const position = usePosition()
  const first = ranked && row.position === 1
  return (
    <li
      id={row.is_me ? 'contributions-me' : undefined}
      tabIndex={row.is_me ? -1 : undefined}
      aria-current={row.is_me ? 'true' : undefined}
      value={ranked ? row.position : undefined}
      data-contributor={row.member.id}
      style={{ '--contribution-delay': `${Math.min(index, 8) * 35}ms` } as CSSProperties}
      className={`contribution-row contribution-enter ${podium ? 'podium-member' : 'contribution-list-row'}`}
      data-me={row.is_me || undefined}
    >
      <div className="contribution-person">
        {ranked && <div className={podium ? 'sr-only' : 'contribution-rank'}>
          <p className="font-extrabold tabular-nums"><span className="language-text">{position(row)}</span></p>
          {row.tied && <p className="contribution-tie language-text">{t('contributions.tied')}</p>}
        </div>}
        <span className="contribution-avatar">
          <Avatar nick={row.member.nick} color={row.member.color} />
        </span>
      </div>
      <div className="contribution-details">
        <p className="contribution-name">
          <span className="contribution-nick">{row.member.nick}</span>
          {row.is_me && <span className="contribution-self">(<span className="language-text">{t('common.you')}</span>)</span>}
          {first && <span className="sr-only">{t(row.tied ? 'contributions.first_tied' : 'contributions.first')}</span>}
        </p>
        <p className="contribution-stats">
          <span className="contribution-stat"><span className="language-text"><ContributionCount value={row.days_published} text={t('contributions.days', { count: row.days_published })} /></span></span>
          <span className="contribution-stat"><span className="language-text"><ContributionCount value={row.items_added} text={t('contributions.items', { count: row.items_added })} /></span></span>
        </p>
      </div>
      <p className="contribution-score">
        <span className="contribution-score-value"><Heart aria-hidden="true" /><ContributionCount value={row.thanks} /></span>
        <span className="contribution-score-label language-text">{t('contributions.thanks_label', { count: row.thanks })}</span>
      </p>
    </li>
  )
}

function PodiumStep({ rows }: { rows: ContributionRow[] }) {
  const { t } = useTranslation()
  const position = usePosition()
  const first = rows[0].position === 1
  const label = `${position(rows[0])}${rows[0].tied ? ` · ${t('contributions.tied')}` : ''}`
  const members = <ol className="podium-members">{rows.map(row => <Row key={row.member.id} row={row} ranked podium />)}</ol>
  return (
    <div className="podium-step" data-position={rows[0].position} data-has-me={rows.some(row => row.is_me) || undefined}
      style={{ '--contribution-delay': `${(3 - rows[0].position) * 100}ms` } as CSSProperties}>
      <div className="podium-card-top" aria-hidden="true">
        <span className="podium-recognition">{first ? <Crown /> : <Medal />}</span>
      </div>
      {rows.length > 2 ? (
        <details className="podium-group">
          <summary className="contribution-action">
            <span className="podium-group-avatars" aria-hidden="true">{rows.slice(0, 3).map(row => <Avatar key={row.member.id} nick={row.member.nick} color={row.member.color} size="sm" />)}</span>
            <span className="language-text block font-extrabold">{t('contributions.group_members', { count: rows.length })}</span>
            <span className="language-text block text-sm font-semibold">{t('contributions.thanks', { count: rows[0].thanks })}</span>
            <span className="language-text mt-2 block text-xs underline underline-offset-4">{t('contributions.group_open')}</span>
            {rows.some(row => row.is_me) && <span className="language-text mt-1 block text-xs font-bold text-bordeaux">{t('contributions.group_me')}</span>}
          </summary>
          {members}
        </details>
      ) : members}
      <p className="podium-plinth"><span className="language-text">{label}</span></p>
    </div>
  )
}

function Ranking({ ranking, allZero }: { ranking: ContributionRow[]; allZero: boolean }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useRankingMotion(ref, ranking.map(row => `${row.member.id}:${row.position}:${row.thanks}`).join(','))
  const onPodium = (row: ContributionRow) => !allZero && row.position <= 3 && row.thanks > 0
  const groups = [1, 2, 3].map(position => ranking.filter(row => row.position === position && onPodium(row))).filter(rows => rows.length)
  const remaining = ranking.filter(row => !onPodium(row))
  const List = allZero ? 'ul' : 'ol'
  return (
    <div ref={ref} className="contribution-ranking">
      {!allZero && <div className="ranking-stage">
        <div className="contribution-podium" role="group" aria-label={t('contributions.podium')}>{groups.map(rows => <PodiumStep key={rows[0].position} rows={rows} />)}</div>

      </div>}
      {remaining.length > 0 && <div className="contribution-list-section">
        {!allZero && <div className="contribution-list-heading"><h3 className="language-text">{t('contributions.list_title')}</h3><span className="language-text">{t('contributions.group_members', { count: remaining.length })}</span></div>}
        <List start={allZero ? undefined : remaining[0].position} className="contribution-list">
          {remaining.map((row, index) => <Row key={row.member.id} row={row} ranked={!allZero} index={index} />)}
        </List>
      </div>}
    </div>
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
          className="contribution-action flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-bold hover:bg-ink/5 sm:px-5">
          <Info className="size-5 shrink-0 text-bordeaux" aria-hidden />
          <span className="language-text min-w-0 flex-1 break-words">{t('contributions.rules_title')}</span>
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

function MyPosition({ row, allZero, ranking }: { row: ContributionRow; allZero: boolean; ranking: ContributionRow[] }) {
  const { t } = useTranslation()
  const position = usePosition()
  const next = ranking.filter(member => member.thanks > row.thanks).at(-1)
  const gap = next ? next.thanks - row.thanks : 0
  const go = () => {
    const target = document.getElementById('contributions-me')
    if (!target) return
    const group = target.closest('details')
    if (group) group.open = true
    target.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    target.focus({ preventScroll: true })
    if (!reducedMotion()) target.animate([{ boxShadow: 'inset 0 0 0 3px var(--color-azzurro)' }, { boxShadow: 'inset 0 0 0 0 transparent' }], { duration: 900 })
  }
  return (
    <Card className="contribution-passport">
      <Avatar nick={row.member.nick} color={row.member.color} />
      <div className="min-w-0 flex-1 basis-44">
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
      <button type="button" onClick={go} className="contribution-action -ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-bordeaux hover:bg-bordeaux-soft sm:ml-0">
        <LocateFixed className="size-4" aria-hidden /> <span className="language-text">{t('contributions.go_to_me')}</span><ArrowUpRight className="size-3.5" aria-hidden />
      </button>
      <div className="contribution-goal">
        <span className="contribution-goal-icon" aria-hidden="true">{next ? <ArrowUpRight /> : <Sparkles />}</span>
        <div>
          <p className="contribution-goal-title language-text">{t(allZero ? 'contributions.goal_start' : next ? 'contributions.goal_next' : 'contributions.goal_first')}</p>
          <p className="contribution-goal-detail language-text">{next ? t('contributions.goal_gap', { count: gap, position: position(next) }) : t(allZero ? 'contributions.goal_start_note' : 'contributions.goal_first_note')}</p>
        </div>
        {next && <div className="contribution-goal-track" role="progressbar" aria-label={t('contributions.goal_progress', { position: position(next) })} aria-valuemin={0} aria-valuemax={next.thanks} aria-valuenow={row.thanks}>
          <span style={{ width: `${row.thanks / next.thanks * 100}%` }} />
        </div>}
      </div>
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
      <div className="contributions-page space-y-5">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge className="bg-bordeaux-soft text-bordeaux"><span className="language-text">{t('contributions.period', { label: period.label })}</span></Badge>
          <span className="text-muted"><span className="language-text">{t('contributions.period_range', { start: dates.format(parseDay(period.start)), end: dates.format(parseDay(period.end)) })}</span></span>
        </p>



        {nothing ? (
          <Card>
            <EmptyState title={t('contributions.empty_title')} text={t('contributions.empty_text')} />
          </Card>
        ) : (
          <>
            {me && <MyPosition row={me} allZero={allZero} ranking={ranking} />}
            <section aria-labelledby="ranking-title">
              <h2 id="ranking-title" className="mb-2 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('contributions.ranking_title')}</span></h2>
              {allZero && (
                <div role="note" className="mb-3 rounded-2xl border border-line bg-surface p-4">
                  <p className="font-semibold"><span className="language-text">{t('contributions.all_zero_title')}</span></p>
                  <p className="mt-0.5 text-sm text-muted"><span className="language-text">{t('contributions.all_zero_text')}</span></p>
                </div>
              )}
              {/* With no Grazie at all nobody is ranked: an alphabetical list, no positions. */}
              <Ranking ranking={ranking} allZero={allZero} />
            </section>
          </>
        )}

        <StreakPanel className="space-y-3" streak={streak} scope={`${info.code}.${period.start}`}>
          <StreakHeadline streak={streak} />
          <StreakDays streak={streak} />
          <StreakNote streak={streak} />
          {streak.days.length > 0 && <StreakLegend statuses={(['published', 'late', 'missed', 'today_open'] as const).filter((s) => seen.has(s) || s !== 'today_open')} />}
        </StreakPanel>

        <Rules period={period} />
      </div>
    )
  })()

  return (
    <div>
      <Link to={`/c/${info.code}/classe`} state={{ focus: 'contributions' }} className="contribution-action -ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> <span className="language-text">{t('contributions.back')}</span>
      </Link>
      <h1 ref={heading} tabIndex={-1} data-page-focus="" className="break-words text-2xl font-extrabold tracking-tight"><span className="language-text">{t('contributions.title')}</span></h1>
      <p className="mb-4 mt-1 max-w-prose text-muted"><span className="language-text">{t('contributions.intro')}</span></p>
      {body}
    </div>
  )
}
