import { Backpack, FlaskConical, Link as LinkIcon, Pause, Play, Square, StickyNote, Target, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { attachmentUrl } from '../api'
import { capitalize, longDay, subjectColor, subjectName, timeOf } from '../lib/format'
import { useSpeech } from '../lib/speech'
import type { Card, ClassInfo, Entry, Lesson, Subject } from '../types'
import { ShareButton } from './ShareButton'
import { ItemRow } from './items'
import { Avatar, Badge, Modal } from './ui'

export function LessonsStrip({ lessons, subjects }: { lessons: Lesson[]; subjects: Subject[] }) {
  const { t, i18n } = useTranslation()
  if (!lessons.length) return <p className="text-sm text-muted"><span className="language-text">{t('today.no_lessons')}</span></p>
  return (
    <ol className="flex flex-wrap gap-2">
      {lessons.map((l) => (
        <li
          key={`${l.subject_code}-${l.hours_label}`}
          className="flex min-w-[8.5rem] flex-1 flex-col rounded-xl border border-line bg-surface px-3 py-2"
          style={{ borderTopColor: subjectColor(subjects, l.subject_code), borderTopWidth: 4 }}
        >
          <span className="text-xs font-medium text-muted">
            <span className="language-text">{l.hours.length > 1 ? t('day.hours', { h: l.hours_label }) : t('day.hour', { h: l.hours_label })}</span> · {l.start}
          </span>
          <span className="font-semibold leading-tight">{subjectName(subjects, l.subject_code, i18n.language)}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            {l.room}
            {l.is_lab && <Badge className="bg-verde-soft text-verde-ink"><span className="language-text">{t('day.lab')}</span></Badge>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function EntryPhotos({ ids }: { ids: number[] }) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState<number | null>(null)
  if (!ids.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ids.map((id) => (
        <button key={id} onClick={() => setZoom(id)} className="overflow-hidden rounded-lg border border-line" aria-label={t('day.photo_open')}>
          <img src={attachmentUrl(id)} alt="" className="h-20 w-auto object-cover" loading="lazy" />
        </button>
      ))}
      <Modal open={zoom !== null} onClose={() => setZoom(null)} title={t('day.photos')} wide>
        {zoom !== null && <img src={attachmentUrl(zoom)} alt="" className="w-full rounded-lg" />}
      </Modal>
    </div>
  )
}

export function LabBox({ entry }: { entry: Pick<Entry, 'lab'> }) {
  const { t } = useTranslation()
  const lab = entry.lab
  if (!lab) return null
  const rows = [
    { icon: Target, label: t('day.lab_goal'), value: lab.goal },
    { icon: LinkIcon, label: t('day.lab_repo'), value: lab.repo_url, link: true },
    { icon: TriangleAlert, label: t('day.lab_pitfall'), value: lab.pitfall, warn: true },
    { icon: Backpack, label: t('day.lab_bring'), value: lab.bring },
  ].filter((r) => r.value)
  if (!rows.length) return null
  return (
    <div className="mt-3 rounded-xl border border-verde/30 bg-verde-soft p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-verde-ink">
        <FlaskConical className="size-4" /> <span className="language-text">{t('day.lab_title')}</span>
      </p>
      <dl className="space-y-1.5 text-sm">
        {rows.map((r, index) => (
          <div key={index} className="flex gap-2">
            <r.icon className={`mt-0.5 size-4 shrink-0 ${r.warn ? 'text-rosa-ink' : 'text-verde-ink'}`} aria-hidden />
            <dt className="language-text sr-only">{r.label}</dt>
            <dd className="min-w-0">
              <span className="language-text font-semibold">{r.label}: </span>
              {r.link ? (
                <a href={r.value} target="_blank" rel="noreferrer noopener" className="break-all font-medium text-azzurro-ink underline">
                  {r.value.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <span className={r.warn ? 'font-mono text-[13px]' : ''}>{r.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function DayCardView({ card, subjects, classLabel, classInfo, canShare }: { card: Card; subjects: Subject[]; classLabel?: string; classInfo?: ClassInfo; canShare?: boolean }) {
  const { t, i18n } = useTranslation()
  const [zoom, setZoom] = useState<number | null>(null)
  const entries = card.entries.filter((e) => e.bullets.length || e.lab || e.attachment_ids?.length || e.lesson_status !== 'svolta')
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        {card.author && <Avatar nick={card.author.nick} color={card.author.color} />}
        <div className="min-w-[12rem] flex-1">
          <h2 className="font-bold leading-tight">{capitalize(longDay(card.day, i18n.language))}</h2>
          <p className="text-sm text-muted">
            {[classLabel, card.author && t('day.by', { nick: card.author.nick }), card.published_at && t('day.published_at', { time: timeOf(card.published_at, i18n.language) })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {classInfo && canShare && <ShareButton card={card} info={classInfo} />}
          <ListenButton card={card} subjects={subjects} />
        </div>
      </header>

      <div className="divide-y divide-line">
        {entries.length === 0 && <p className="px-5 py-4 text-muted"><span className="language-text">{t('day.nothing_written')}</span></p>}
        {entries.map((e, i) => (
          <section key={`${e.subject_code}-${i}`} className="flex gap-3 px-4 py-4 sm:px-5">
            <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColor(subjects, e.subject_code) }} aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{subjectName(subjects, e.subject_code, i18n.language)}</span>
                {e.hours && <span className="text-xs text-muted"><span className="language-text">{e.hours.includes('-') ? t('day.hours', { h: e.hours }) : t('day.hour', { h: e.hours })}</span></span>}
                {e.is_lab && <Badge className="bg-verde-soft text-verde-ink"><span className="language-text">{t('day.lab')}</span> {e.room}</Badge>}
                {e.lesson_status !== 'svolta' && <Badge className="bg-giallo-soft text-ink"><span className="language-text">{t(`day.status_${e.lesson_status}`)}</span></Badge>}
              </h3>
              {e.bullets.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] leading-relaxed marker:text-muted">
                  {e.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
              <EntryPhotos ids={e.attachment_ids ?? []} />
              <LabBox entry={e} />
            </div>
          </section>
        ))}
      </div>

      {card.items.length > 0 && (
        <section className="border-t border-line bg-paper/60 px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('day.assigned')}</span></h3>
          <div className="space-y-2">
            {card.items.map((it) => (
              <ItemRow key={it.id} item={it} subjects={subjects} compact />
            ))}
          </div>
        </section>
      )}

      {card.notes && (
        <section className="border-t border-line px-4 py-4 sm:px-5">
          <div className="rounded-xl bg-giallo-soft p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
              <StickyNote className="size-4" /> <span className="language-text">{t('day.notes')}</span>
            </p>
            <p className="whitespace-pre-line text-[15px]">{card.notes}</p>
          </div>
        </section>
      )}

      {card.attachments.length > 0 && (
        <section className="border-t border-line px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('day.attachments')}</span></h3>
          <div className="flex flex-wrap gap-2">
            {card.attachments.map((a) => (
              <button key={a.id} onClick={() => setZoom(a.id)} className="overflow-hidden rounded-lg border border-line">
                <img src={attachmentUrl(a.id)} alt="" className="h-24 w-auto object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <Modal open={zoom !== null} onClose={() => setZoom(null)} title={t('day.attachments')} wide>
            {zoom !== null && <img src={attachmentUrl(zoom)} alt="" className="w-full rounded-lg" />}
          </Modal>
        </section>
      )}
    </article>
  )
}

export function speechText(card: Card, subjects: Subject[], t: TFunction, lang: string): string {
  const parts: string[] = [t('listen.s_intro', { day: longDay(card.day, lang), nick: card.author?.nick ?? '' })]
  for (const e of card.entries) {
    const name = subjectName(subjects, e.subject_code, lang)
    if (e.lesson_status === 'non_svolta') {
      parts.push(`${name}: ${t('listen.s_not_done')}`)
      continue
    }
    if (!e.bullets.length && !e.lab) continue
    parts.push(`${name}${e.is_lab ? `, ${t('listen.s_lab')}` : '.'} ${e.bullets.join('. ')}.`)
    if (e.lab?.goal) parts.push(t('listen.s_goal', { v: e.lab.goal }))
    if (e.lab?.pitfall) parts.push(t('listen.s_pitfall', { v: e.lab.pitfall }))
    if (e.lab?.bring) parts.push(t('listen.s_bring', { v: e.lab.bring }))
  }
  if (card.items.length) {
    parts.push(t('listen.s_assigned'))
    for (const it of card.items) {
      const vars = { type: t(`types.${it.type}`), subject: subjectName(subjects, it.subject_code, lang), title: it.title, day: longDay(it.due_date, lang) }
      parts.push(it.subject_code ? t('listen.s_item', vars) : t('listen.s_item_nosub', vars))
    }
  }
  if (card.notes) parts.push(t('listen.s_notes', { v: card.notes }))
  return parts.join(' ')
}

export function ListenButton({ card, subjects }: { card: Card; subjects: Subject[] }) {
  const { t, i18n } = useTranslation()
  const speech = useSpeech()
  if (!speech.supported) return <p role="status" className="text-sm text-muted"><span className="language-text">{t('listen.unsupported')}</span></p>
  if (speech.state === 'idle') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => speech.play(speechText(card, subjects, t, i18n.language), i18n.language)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bordeaux-soft px-3 text-sm font-semibold text-bordeaux hover:bg-bordeaux/15"
        >
          <Play className="size-4" /> <span className="language-text">{t('listen.play')}</span>
        </button>
        {speech.error && <p role="alert" className="max-w-64 text-sm text-bordeaux"><span className="language-text">{t(`listen.${speech.error}`)}</span></p>}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button
        disabled={speech.state === 'loading'}
        onClick={speech.state === 'playing' ? speech.pause : speech.resume}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bordeaux px-3 text-sm font-semibold text-white"
      >
        {speech.state === 'playing' ? <Pause className="size-4" /> : <Play className="size-4" />}
        <span className="language-text">{speech.state === 'loading' ? t('listen.loading') : speech.state === 'playing' ? t('listen.pause') : t('listen.resume')}</span>
      </button>
      <button onClick={speech.stop} className="rounded-full p-2 hover:bg-ink/5" aria-label={t('listen.stop')}>
        <Square className="size-4" />
      </button>
    </div>
  )
}
