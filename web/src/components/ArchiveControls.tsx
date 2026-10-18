import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { archivePeriod, type ArchivePeriod } from '../lib/archive'
import { isoDay, parseDay, todayIso } from '../lib/clock'
import { Button, ErrorBox, inputClass } from './ui'

export function ArchiveControls({ fallback }: { fallback: ArchivePeriod }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [search, setSearch] = useSearchParams()
  const period = archivePeriod(search, fallback)
  const id = useId()
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(search)
    for (const key of ['period', 'month', 'from', 'to', 'pages']) next.delete(key)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value)
    setSearch(next, { state: { ...location.state, archiveY: 0 } })
  }
  function monthStep(delta: number) {
    const day = parseDay(`${period.month}-01`)
    day.setMonth(day.getMonth() + delta)
    update({ period: 'month', month: isoDay(day).slice(0, 7) })
  }
  return (
    <section aria-label={t('archive.filters')} className="space-y-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-period`} className="mb-1 block text-xs font-semibold text-muted">{t('archive.period')}</label>
          <select id={`${id}-period`} value={period.mode} className={`${inputClass} w-full`} onChange={event => update({ period: event.target.value, ...(event.target.value === 'month' ? { month: todayIso().slice(0, 7) } : {}) })}>
            {(['week', '2weeks', 'all', 'month', 'custom'] as const).map(value => <option key={value} value={value}>{t(`archive.${value}`)}</option>)}
          </select>
        </div>
        {period.mode === 'month' && (
          <div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 min-[360px]:flex sm:w-auto">
            <Button variant="secondary" aria-label={t('archive.prev_month')} onClick={() => monthStep(-1)} disabled={!period.valid || period.month <= '0001-01'} className="shrink-0 px-3"><ChevronLeft className="size-4" /></Button>
            <div className="col-span-2 row-start-1 min-w-0 flex-1">
              <label htmlFor={`${id}-month`} className="mb-1 block text-xs font-semibold text-muted">{t('archive.month')}</label>
              <input id={`${id}-month`} type="month" min="0001-01" max="9999-12" className={`${inputClass} min-w-0 w-full`} value={period.month} onChange={event => { if (event.target.value) update({ period: 'month', month: event.target.value }) }} />
            </div>
            <Button variant="secondary" aria-label={t('archive.next_month')} onClick={() => monthStep(1)} disabled={!period.valid || period.month >= '9999-12'} className="shrink-0 px-3"><ChevronRight className="size-4" /></Button>
          </div>
        )}
      </div>
      {period.mode === 'custom' && <CustomRange key={`${period.from}|${period.to}`} from={period.from} to={period.to} onApply={(from, to) => update({ period: 'custom', from, to })} />}
      {!period.valid && <p role="alert" className="text-sm font-semibold text-rosa-ink">{t('archive.invalid_dates')}</p>}
    </section>
  )
}

function CustomRange({ from, to, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)
  const invalid = !!(start && end && start > end)
  return (
    <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (!invalid) onApply(start, end) }}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="min-w-0"><label htmlFor={`${id}-from`} className="mb-1 block text-xs font-semibold text-muted">{t('archive.from')}</label><input id={`${id}-from`} type="date" min="0001-01-01" max="9999-12-31" value={start} onChange={event => setStart(event.target.value)} className={`${inputClass} min-w-0 w-full`} /></div>
        <div className="min-w-0"><label htmlFor={`${id}-to`} className="mb-1 block text-xs font-semibold text-muted">{t('archive.to')}</label><input id={`${id}-to`} type="date" min="0001-01-01" max="9999-12-31" value={end} onChange={event => setEnd(event.target.value)} className={`${inputClass} min-w-0 w-full`} /></div>
        <Button type="submit" variant="secondary" disabled={invalid}>{t('archive.apply')}</Button>
      </div>
      {invalid && <p role="alert" className="text-sm font-semibold text-rosa-ink">{t('archive.invalid_dates')}</p>}
    </form>
  )
}

export function ArchivePagination({ count, hasMore, loading, error, onMore }: { count: number; hasMore: boolean; loading: boolean; error: unknown; onMore: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 py-2 text-center">
      {!!error && <ErrorBox error={error} onRetry={onMore} />}
      <p role="status" aria-live="polite" className="text-sm text-muted">{loading ? t('archive.loading') : hasMore ? t('archive.loaded', { count }) : t('archive.end', { count })}</p>
      {hasMore && !error && <Button variant="secondary" loading={loading} onClick={onMore}>{t('archive.load_more')}</Button>}
    </div>
  )
}
