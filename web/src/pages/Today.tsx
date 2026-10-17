import { Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Feedback } from '../components/Feedback'
import { CorrectionInbox, ItemCorrectionsProvider } from '../components/ItemCorrections'
import { Deadlines, LessonTimeline, NextSchoolDay, TodayHeader, WriteInvite } from '../components/today'
import { ErrorBox, Spinner } from '../components/ui'
import { parseDay } from '../lib/clock'
import { enter } from '../lib/today'
import { useClass, useToday } from '../queries'

export function isWeekend(iso: string): boolean {
  const wd = parseDay(iso).getDay()
  return wd === 0 || wd === 6
}

export function DemoWeekendNote() {
  const { t } = useTranslation()
  return (
    <p className="flex gap-2 rounded-xl border border-azzurro/20 bg-azzurro-soft px-3 py-2 text-sm text-azzurro-ink">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> <span className="language-text">{t('banner.demo_weekend')}</span>
    </p>
  )
}

export default function Today() {
  const info = useClass()
  const today = useToday(info.code)
  // The opening sequence plays once per visit: later data, language or theme changes never replay it.
  const [settled, setSettled] = useState(false)
  const ready = !!today.data
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setSettled(true), 1600)
    return () => window.clearTimeout(id)
  }, [ready])
  if (today.isLoading) return <Spinner />
  if (today.error) return <ErrorBox error={today.error} onRetry={() => today.refetch()} />
  const data = today.data!
  const published = data.status === 'published' ? data.card : null
  return (
    <ItemCorrectionsProvider>
      <div className="today-page space-y-5" data-settled={settled || undefined}>
        <TodayHeader data={data} />
        <CorrectionInbox />
        <div className="today-grid">
          <div className="today-side"><Deadlines data={data} index={1} /></div>
          <div className="today-main space-y-5">
            {data.status === 'no_school'
              ? <NextSchoolDay data={data} />
              : <LessonTimeline data={data} published={published} invite={!published && <WriteInvite data={data} />} />}
            {published && (
              <div className="today-enter" style={enter(3)}>
                <Feedback code={info.code} day={data.day} readOnly={info.viewer.read_only} />
              </div>
            )}
            {info.is_demo && isWeekend(data.day) && <DemoWeekendNote />}
          </div>
        </div>
      </div>
    </ItemCorrectionsProvider>
  )
}
