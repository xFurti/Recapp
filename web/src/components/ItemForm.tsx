import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, todayIso } from '../lib/clock'
import { shortDay, subjectName } from '../lib/format'
import type { ItemSource, ItemType, Subject } from '../types'
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
}: {
  open: boolean
  initial: ItemInput | null
  subjects: Subject[]
  nextLessons: Record<string, string>
  baseDay?: string
  onClose: () => void
  onSubmit: (item: ItemInput) => void
  onDelete?: () => void
  busy?: boolean
  error?: string | null
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [item, setItem] = useState<ItemInput | null>(initial)
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
    if (!item.title.trim()) return
    onSubmit({ ...item, title: item.title.trim(), due_time: item.due_time || null })
  }

  const title = item.id ? t('item_form.edit') : t(`item_form.new_${item.type}`)

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('item_form.type')}>
          {TYPES.map((ty) => {
            const Icon = TYPE_STYLE[ty].icon
            return (
              <Chip key={ty} active={item.type === ty} onClick={() => set({ type: ty })}>
                <Icon className="size-4" /> {t(`types.${ty}`)}
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
          <input className={inputClass} value={item.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('item_form.title_ph')} maxLength={200} required autoFocus />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-semibold">{t('item_form.when')}</span>
          <div className="mb-2 flex flex-wrap gap-2">
            {quick.map((q) => (
              <Chip key={q.label} active={item.due_date === q.value} onClick={() => set({ due_date: q.value })}>
                {q.label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input type="date" className={inputClass} value={item.due_date} onChange={(e) => set({ due_date: e.target.value })} aria-label={t('item_form.pick_date')} required />
            <input
              type="time"
              className={`${inputClass} w-32`}
              value={item.due_time ?? ''}
              onChange={(e) => set({ due_time: e.target.value || null })}
              aria-label={`${t('item_form.time')} (${t('common.optional')})`}
            />
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
        {error && <p className="text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
        <div className="flex gap-2 pt-1">
          {onDelete && (
            <Button type="button" variant="danger" onClick={onDelete}>
              {t('common.delete')}
            </Button>
          )}
          <Button type="submit" className="flex-1" loading={busy} disabled={!item.title.trim()}>
            {item.id ? t('item_form.save') : t('item_form.add')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
