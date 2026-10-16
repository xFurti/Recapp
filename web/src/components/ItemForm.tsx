import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, todayIso } from '../lib/clock'
import { shortDay, subjectName } from '../lib/format'
import { CORRECTION_FIELDS, type ItemSource, type ItemType, type Subject } from '../types'
import { TYPE_STYLE } from './items'
import { Button, Chip, Field, inputClass, Modal } from './ui'

export interface ItemInput {
  id?: number
  key?: string
  type: ItemType
  subject_code: string | null
  title: string
  due_date: string
  due_time: string | null
  source: ItemSource
  link: string
  attachment_id?: number | null
}

const TYPES: ItemType[] = ['compito', 'verifica', 'evento', 'lab']
const SOURCES: ItemSource[] = ['detto in classe', 'ClasseViva', 'Classroom', 'Campus', 'altro']

export function emptyItem(type: ItemType, subject: string | null, nextLessons: Record<string, string>, baseDay = todayIso()): ItemInput {
  return {
    type,
    subject_code: subject,
    title: '',
    due_date: (subject && nextLessons[subject]) || addDays(baseDay, 1),
    due_time: null,
    source: 'detto in classe',
    link: '',
  }
}

export function ItemForm({
  open,
  initial,
  subjects,
  nextLessons,
  baseDay,
  onClose,
  onSubmit,
  onDelete,
  busy,
  error,
  correction,
}: {
  open: boolean
  initial: ItemInput | null
  subjects: Subject[]
  nextLessons: Record<string, string>
  baseDay?: string
  onClose: () => void
  onSubmit: (item: ItemInput, reason?: string) => void
  onDelete?: () => void
  busy?: boolean
  error?: string | null
  correction?: { current: ItemInput; reason: string; pending: boolean }
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [item, setItem] = useState<ItemInput | null>(initial)
  const [reason, setReason] = useState(correction?.reason ?? '')
  if (!item) return null
  const base = baseDay ?? todayIso()
  const set = (patch: Partial<ItemInput>) => setItem((prev) => (prev ? { ...prev, ...patch } : prev))
  const next = item.subject_code ? nextLessons[item.subject_code] : undefined
  const quick = [
    next && { label: t('item_form.next_lesson', { day: shortDay(next, lang) }), value: next },
    { label: t('item_form.tomorrow'), value: addDays(base, 1) },
    { label: t('item_form.in_week'), value: addDays(base, 7) },
  ].filter(Boolean) as { label: string; value: string }[]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy || !item.title.trim() || (correction && !reason.trim())) return
    onSubmit({ ...item, title: item.title.trim(), due_time: item.due_time || null }, reason.trim())
  }

  const title = correction ? t('item_corrections.report') : item.id ? t('item_form.edit') : t(`item_form.new_${item.type}`)
  // Compare the same trimmed title that submit sends, so a trailing space alone
  // never enables a proposal the API would reject as unchanged.
  const hasChanges = !correction || CORRECTION_FIELDS.some(field => (field === 'title' ? item.title.trim() : item[field]) !== correction.current[field])

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose() }} title={title}>
      <form onSubmit={submit} className="space-y-4">
        {correction && <p className="text-sm leading-relaxed text-muted">{t('item_corrections.form_hint')}</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('item_form.type')}>
            {TYPES.map((ty) => {
              const Icon = TYPE_STYLE[ty].icon
              return (
                <Chip key={ty} active={item.type === ty} onClick={() => set({ type: ty })}>
                  <Icon className="size-4" /> <span className="language-text">{t(`types.${ty}`)}</span>
                </Chip>
              )
            })}
          </div>
          <Field label={t('item_form.subject')}>
            <select
              className={inputClass}
              value={item.subject_code ?? ''}
              onChange={(e) => {
                const code = e.target.value || null
                set({ subject_code: code, ...(code && nextLessons[code] && !item.id ? { due_date: nextLessons[code] } : {}) })
              }}
            >
              <option value="">{t('item_form.no_subject')}</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {subjectName(subjects, s.code, lang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('item_form.title')}>
            {/* Modal locks the page and remembers the opener before managing focus. */}
            <input className={inputClass} value={item.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('item_form.title_ph')} maxLength={200} required />
          </Field>
          <div>
            <span className="mb-1 block text-sm font-semibold"><span className="language-text">{t('item_form.when')}</span></span>
            <div className="mb-2 flex flex-wrap gap-2">
              {quick.map((q, index) => (
                <Chip key={index} active={item.due_date === q.value} onClick={() => set({ due_date: q.value })}>
                  <span className="language-text">{q.label}</span>
                </Chip>
              ))}
            </div>
            <div className={correction ? 'min-w-0' : 'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'}>
              <input type="date" className={inputClass} value={item.due_date} onChange={(e) => set({ due_date: e.target.value })} aria-label={t('item_form.pick_date')} required />
              {!correction && <input
                type="time"
                className={`${inputClass} sm:w-32`}
                value={item.due_time ?? ''}
                onChange={(e) => set({ due_time: e.target.value || null })}
                aria-label={`${t('item_form.time')} (${t('common.optional')})`}
              />}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('item_form.source')}>
              <select className={inputClass} value={item.source} onChange={(e) => set({ source: e.target.value as ItemSource })}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sources.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`${t('item_form.link')} (${t('common.optional')})`}>
              <input className={inputClass} value={item.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" inputMode="url" />
            </Field>
          </div>
          {correction && (
            <Field label={t('item_corrections.reason')} hint={t('item_corrections.reason_hint')}>
              <textarea className={`${inputClass} min-h-24 resize-y`} aria-label={t('item_corrections.reason')} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} required />
            </Field>
          )}
        </fieldset>
        {error && <p className="text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
        <div className="flex gap-2 pt-1">
          {onDelete && (
            <Button type="button" variant="danger" onClick={onDelete}>
              <span className="language-text">{t('common.delete')}</span>
            </Button>
          )}
          {correction && <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>}
          <Button type="submit" className="flex-1" loading={busy} disabled={!item.title.trim() || !hasChanges || (!!correction && !reason.trim())}>
            <span className="language-text">{correction ? t(correction.pending ? 'item_corrections.update' : 'item_corrections.send') : item.id ? t('item_form.save') : t('item_form.add')}</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
