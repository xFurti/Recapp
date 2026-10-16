import { Check, ChevronRight, Flame, History, Hourglass, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { parseDay } from '../lib/clock'
import { capitalize, locale, longDay } from '../lib/format'
import { useClass, useContributions } from '../queries'
import type { StreakDayStatus, StreakInfo } from '../types'
import { ErrorBox } from './ui'

/** Every status has its own icon and text, so the sequence reads without color. */
const STREAK_STATUS: Record<StreakDayStatus, { icon: LucideIcon; tile: string }> = {
  published: { icon: Check, tile: 'border-verde/40 bg-verde-soft text-verde-ink' },
  late: { icon: History, tile: 'border-giallo/60 bg-giallo-soft text-ink' },
  missed: { icon: X, tile: 'border-rosa/30 bg-rosa-soft text-rosa-ink' },
  today_open: { icon: Hourglass, tile: 'border-dashed border-ink/40 bg-surface text-muted' },
}

const contributionsPath = (code: string) => `/c/${code}/classe/contributi`

export function StreakDays({ streak }: { streak: StreakInfo }) {
  const { t, i18n } = useTranslation()
  if (!streak.days.length) return null
  const weekday = new Intl.DateTimeFormat(locale(i18n.language), { weekday: 'short' })
  return (
    <ol className="grid grid-cols-[repeat(auto-fit,minmax(2rem,1fr))] gap-x-1 gap-y-3" aria-label={t('contributions.streak_days')}>
      {streak.days.map(({ day, status }) => {
        const style = STREAK_STATUS[status]
        const Icon = style.icon
        const today = day === streak.today
        const label = t('contributions.day_status', { day: capitalize(longDay(day, i18n.language)), status: t(`contributions.status_${status}`) })
        return (
          <li key={day} title={label} className="flex min-w-0 flex-col items-center gap-1 text-center" data-status={status}>
            <span aria-hidden className={`max-w-full truncate text-[11px] font-semibold leading-none ${today ? 'text-ink' : 'text-muted'}`}>
              <span className={today ? 'language-text' : ''}>{today ? t('contributions.today_short') : weekday.format(parseDay(day)).replace(/\./g, '')}</span>
            </span>
            <span aria-hidden className={`flex size-8 items-center justify-center rounded-full border-2 ${style.tile}`}>
              <Icon className="size-4" strokeWidth={2.5} />
            </span>
            <span aria-hidden className="text-xs font-semibold tabular-nums leading-none">{parseDay(day).getDate()}</span>
            <span className="language-text sr-only">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function StreakLegend({ statuses }: { statuses: StreakDayStatus[] }) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      {statuses.map((status) => {
        const style = STREAK_STATUS[status]
        const Icon = style.icon
        return (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={`flex size-5 items-center justify-center rounded-full border ${style.tile}`}>
              <Icon className="size-3" strokeWidth={2.5} />
            </span>
            <span className="language-text">{t(`contributions.status_${status}`)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** "5 giornate di fila" and "Record 7", or the invitation to start when nothing was ever published. */
export function StreakHeadline({ streak, level = 'h2' }: { streak: StreakInfo; level?: 'h2' | 'h3' }) {
  const { t } = useTranslation()
  const Heading = level
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${streak.current > 0 ? 'bg-bordeaux-soft text-bordeaux' : 'bg-ink/5 text-muted'}`}>
        <Flame className="size-6" />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <Heading className="text-xl font-extrabold leading-tight tracking-tight">
          <span className="language-text">{streak.has_published || streak.current > 0 ? t('contributions.streak_count', { count: streak.current }) : t('contributions.streak_empty')}</span>
        </Heading>
        <p className="text-sm font-semibold text-muted"><span className="language-text">{t('contributions.streak_record', { count: streak.record })}</span></p>
      </div>
    </div>
  )
}

export function StreakNote({ streak }: { streak: StreakInfo }) {
  const { t } = useTranslation()
  if (!streak.has_published) return <p className="text-sm text-muted"><span className="language-text">{t('contributions.streak_invite')}</span></p>
  if (streak.current === 0) return <p className="text-sm text-muted"><span className="language-text">{t('contributions.streak_restart')}</span></p>
  return null
}

/** Compact summary at the top of Classe. The full ranking lives in its own view. */
export function StreakCard() {
  const info = useClass()
  const { t } = useTranslation()
  const data = useContributions(info.code)
  return (
    <section aria-labelledby="streak-card-title" className="mb-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p id="streak-card-title" className="mb-3 text-xs font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('contributions.streak_title')}</span></p>
      {data.isLoading && (
        <div role="status" className="space-y-3" aria-label={t('common.loading')}>
          <div className="h-11 w-48 animate-pulse rounded-xl bg-ink/5" />
          <div className="h-14 animate-pulse rounded-xl bg-ink/5" />
        </div>
      )}
      {data.error && <ErrorBox error={data.error} onRetry={() => data.refetch()} />}
      {data.data && (
        <div className="space-y-3">
          <StreakHeadline streak={data.data.streak} />
          <StreakDays streak={data.data.streak} />
          <StreakNote streak={data.data.streak} />
        </div>
      )}
      <Link to={contributionsPath(info.code)} className="-mx-2 mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-semibold text-bordeaux hover:bg-bordeaux-soft" data-contributions-link>
        <span className="language-text">{t('contributions.link')}</span>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}
