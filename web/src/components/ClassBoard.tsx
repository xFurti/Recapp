import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { capitalize, shortDay } from '../lib/format'
import { classPath, useClass } from '../queries'
import { Avatar, Card, ErrorBox, Spinner } from './ui'

type BoardMember = { id: number; nick: string; color: string }
type Board = {
  streak: {
    current: number
    record: number
    empty: boolean
    days: { day: string; published: boolean }[]
  }
  ranking: { rank: number; thanks: number; member: BoardMember }[]
}

/** Publishing streak and the thanks ranking. Shown above the class tabs. */
export function ClassBoard() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const board = useQuery({
    queryKey: ['board', info.code],
    queryFn: () => api.get<Board>(classPath(info.code, '/board')),
  })

  if (board.isLoading) return <Spinner />
  if (board.error || !board.data) return <ErrorBox error={board.error} onRetry={() => board.refetch()} />
  const { streak, ranking } = board.data

  return (
    <div className="mb-5 space-y-4">
      <Card>
        <h2 id="streak-title" className="text-sm font-bold uppercase tracking-wide text-muted">
          <span className="language-text">{t('class.streak_title')}</span>
        </h2>
        <table className="mt-3 w-full max-w-xs text-sm" aria-labelledby="streak-title">
          <tbody>
            <tr>
              <th scope="row" className="py-1 text-left font-semibold text-muted">
                <span className="language-text">{t('class.streak_current')}</span>
              </th>
              <td className="py-1 text-right text-lg font-extrabold tabular-nums">{streak.current}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 text-left font-semibold text-muted">
                <span className="language-text">{t('class.streak_record')}</span>
              </th>
              <td className="py-1 text-right text-lg font-extrabold tabular-nums">{streak.record}</td>
            </tr>
          </tbody>
        </table>
        {streak.empty ? (
          <p className="mt-3 text-sm text-muted"><span className="language-text">{t('class.streak_empty')}</span></p>
        ) : (
          <ol className="mt-3 flex flex-wrap gap-2">
            {streak.days.map((day) => {
              const label = capitalize(shortDay(day.day, i18n.language))
              const status = day.published ? t('class.streak_published') : t('class.streak_missed')
              return (
                <li key={day.day} aria-label={`${label}, ${status}`} className="flex min-w-16 flex-col items-center gap-1">
                  <span aria-hidden className={`size-3 rounded-full ${day.published ? 'bg-verde' : 'bg-line'}`} />
                  <span className="text-center text-[11px] font-semibold leading-tight text-muted">{label}</span>
                  <span className="sr-only">{status}</span>
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      <Card>
        <h2 id="thanks-title" className="text-sm font-bold uppercase tracking-wide text-muted">
          <span className="language-text">{t('class.board_title')}</span>
        </h2>
        <ol className="mt-3 space-y-2" aria-labelledby="thanks-title">
          {ranking.map((row) => {
            const lead = row.rank === 1 && row.thanks > 0
            return (
              <li
                key={row.member.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${lead ? 'border-bordeaux/30 bg-bordeaux-soft' : 'border-line bg-paper/40'}`}
              >
                <span className={`w-16 shrink-0 text-sm font-extrabold tabular-nums ${lead ? 'text-bordeaux' : 'text-muted'}`}>
                  {t('class.board_place', { rank: row.rank })}
                  {lead && <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wide"><span className="language-text">{t('class.board_lead')}</span></span>}
                </span>
                <Avatar nick={row.member.nick} color={row.member.color} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{row.member.nick}</span>
                <span className="text-sm font-semibold tabular-nums">
                  <span className="language-text">{t('class.board_thanks', { count: row.thanks })}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
