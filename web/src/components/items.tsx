import { TranslatedMessage } from './TranslatedMessage'
import { BookOpen, ExternalLink, FlaskConical, GraduationCap, Megaphone, Paperclip } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { attachmentUrl } from '../api'
import { countdown, relativeDay, subjectColor, subjectName } from '../lib/format'
import { daysBetween, todayIso } from '../lib/clock'
import type { Item, ItemType, Subject } from '../types'
import { Badge } from './ui'

export const TYPE_STYLE: Record<ItemType, { icon: ComponentType<{ className?: string }>; badge: string; bar: string }> = {
  compito: { icon: BookOpen, badge: 'bg-azzurro-soft text-azzurro-ink', bar: 'bg-azzurro' },
  verifica: { icon: GraduationCap, badge: 'bg-rosa-soft text-rosa-ink', bar: 'bg-rosa' },
  evento: { icon: Megaphone, badge: 'bg-viola-soft text-viola-ink', bar: 'bg-viola' },
  lab: { icon: FlaskConical, badge: 'bg-verde-soft text-verde-ink', bar: 'bg-verde' },
}

export function TypeBadge({ type }: { type: ItemType }) {
  const { t } = useTranslation()
  const s = TYPE_STYLE[type]
  const Icon = s.icon
  return (
    <Badge className={s.badge}>
      <Icon className="size-3.5" />
      <span className="language-text">{t(`types.${type}`)}</span>
    </Badge>
  )
}

export function SubjectTag({ subjects, code }: { subjects: Subject[]; code: string | null }) {
  const { i18n } = useTranslation()
  if (!code) return null
  const color = subjectColor(subjects, code)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide" title={subjectName(subjects, code, i18n.language)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {code}
    </span>
  )
}

function DoneCheck({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  const [drawing, setDrawing] = useState(false)
  useEffect(() => {
    if (!drawing) return
    const id = window.setTimeout(() => setDrawing(false), 700)
    return () => window.clearTimeout(id)
  }, [drawing])
  return (
    <button
      type="button"
      onClick={() => {
        if (!done) setDrawing(true)
        onToggle()
      }}
      aria-pressed={done}
      title={label}
      aria-label={label}
      className={`done-check flex size-9 shrink-0 items-center justify-center self-center rounded-full border ${
        drawing ? 'is-drawing' : ''
      } ${done ? 'is-done border-verde bg-verde text-white' : 'border-line text-muted hover:border-verde hover:text-verde-ink'}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path className="done-check-mark" pathLength={1} d="M7 12.5 10.2 15.7 17 8.5" />
      </svg>
    </button>
  )
}

export function SourceBadge({ source }: { source: string }) {
  const { t } = useTranslation()
  return <Badge className="bg-ink/5 text-muted">{t(`sources.${source}`, { defaultValue: source })}</Badge>
}

export function ItemRow({
  item,
  subjects,
  done,
  onToggleDone,
  onOpen,
  compact,
}: {
  item: Item
  subjects: Subject[]
  done?: boolean
  onToggleDone?: () => void
  onOpen?: () => void
  compact?: boolean
}) {
  const { t, i18n } = useTranslation()
  const s = TYPE_STYLE[item.type]
  const diff = daysBetween(todayIso(), item.due_date)
  const urgent = item.type === 'verifica' && diff >= 0 && diff <= 3
  return (
    <div className={`relative flex gap-3 rounded-xl border border-line bg-surface p-3 ${done ? 'opacity-60' : ''}`}>
      <span className={`w-1 shrink-0 rounded-full ${s.bar}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          <SubjectTag subjects={subjects} code={item.subject_code} />
          {item.type === 'verifica' && diff >= 0 && (
            <Badge className={urgent ? 'bg-rosa text-white' : 'bg-rosa-soft text-rosa-ink'}>{countdown(item.due_date, t)}</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className={`mt-1 block text-left font-semibold leading-snug ${done ? 'line-through' : ''} ${onOpen ? 'hover:underline' : ''}`}
        >
          {item.title}
        </button>
        {!compact && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-medium text-ink/80">
              {relativeDay(item.due_date, t, i18n.language)}
              {item.due_time ? ` · ${item.due_time}` : ''}
            </span>
            <SourceBadge source={item.source} />
            {item.author && <span><TranslatedMessage message={'upcoming.added_by'} values={{ nick: item.author.nick }} /></span>}
            {item.link && (
              <a href={item.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-azzurro-ink hover:underline">
                <ExternalLink className="size-3.5" />
                <span className="language-text">{t('upcoming.open_link')}</span>
              </a>
            )}
            {item.attachment_id && (
              <a href={attachmentUrl(item.attachment_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-azzurro-ink hover:underline">
                <Paperclip className="size-3.5" />
              </a>
            )}
          </div>
        )}
        {compact && (
          <p className="mt-0.5 text-xs text-muted">
            {relativeDay(item.due_date, t, i18n.language)}
            {item.due_time ? ` · ${item.due_time}` : ''}
          </p>
        )}
      </div>
      {onToggleDone && <DoneCheck done={!!done} onToggle={onToggleDone} label={t('upcoming.mark_done')} />}
    </div>
  )
}
