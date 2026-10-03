import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, FlaskConical, ImagePlus, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { api, ApiError, attachmentUrl } from '../api'
import { DayCardView } from '../components/day'
import { emptyItem, ItemForm, type ItemInput } from '../components/ItemForm'
import { SourceBadge, SubjectTag, TYPE_STYLE, TypeBadge } from '../components/items'
import { Badge, Button, Card as Box, EmptyState, ErrorBox, inputClass, Spinner } from '../components/ui'
import { todayIso } from '../lib/clock'
import { capitalize, longDay, relativeDay, subjectColor, subjectName, timeOf } from '../lib/format'
import { classPath, useClass } from '../queries'
import type { Card, CardPage, Draft, Entry, ItemType, LabData, LessonStatus } from '../types'

interface EntryDraft extends Entry {
  key: string
}

interface EditorState {
  entries: EntryDraft[]
  notes: string
  items: ItemInput[]
  attachment_ids: number[]
}

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string | null } | { kind: 'error'; msg: string }

let keySeq = 0
const newKey = () => `k${++keySeq}`
const emptyLab = (): LabData => ({ goal: '', repo_url: '', pitfall: '', bring: '' })
const STATUSES: LessonStatus[] = ['svolta', 'non_svolta', 'supplenza', 'verifica']
const QUICK_TYPES: ItemType[] = ['compito', 'verifica', 'evento']

function initialState(page: CardPage): EditorState {
  if (page.card) {
    return {
      entries: page.card.entries.map((e) => ({
        ...e, bullets: e.bullets.length ? e.bullets : [''], attachment_ids: e.attachment_ids ?? [], key: newKey(),
      })),
      notes: page.card.notes,
      items: page.card.items.map((i) => ({
        id: i.id, key: newKey(), type: i.type, subject_code: i.subject_code, title: i.title, due_date: i.due_date,
        due_time: i.due_time, source: i.source, link: i.link, attachment_id: i.attachment_id,
      })),
      attachment_ids: page.card.attachments.map((a) => a.id),
    }
  }
  return {
    entries: page.lessons.map((l) => ({
      key: newKey(), subject_code: l.subject_code, hours: l.hours_label, room: l.room, is_lab: l.is_lab,
      lesson_status: 'svolta', bullets: [''], lab: l.is_lab ? emptyLab() : null, attachment_ids: [],
    })),
    notes: '',
    items: [],
    attachment_ids: [],
  }
}

function toPayload(s: EditorState, revision?: number) {
  return {
    revision,
    entries: s.entries.map((e) => ({
      subject_code: e.subject_code, hours: e.hours, room: e.room, is_lab: e.is_lab, lesson_status: e.lesson_status,
      bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
      lab: e.is_lab && e.lab ? e.lab : null,
      attachment_ids: e.attachment_ids,
    })),
    notes: s.notes,
    items: s.items.map((i) => ({
      id: i.id, type: i.type, subject_code: i.subject_code, title: i.title, due_date: i.due_date,
      due_time: i.due_time, source: i.source, link: i.link, attachment_id: i.attachment_id ?? null,
    })),
    attachment_ids: s.attachment_ids,
  }
}

function assignIds(state: EditorState, card: Card): EditorState {
  const known = new Set(state.items.filter((i) => i.id).map((i) => i.id))
  const fresh = card.items.filter((i) => !known.has(i.id))
  return {
    ...state,
    items: state.items.map((it) => {
      if (it.id) return it
      const idx = fresh.findIndex((s) => s.type === it.type && s.title === it.title && s.due_date === it.due_date && (s.subject_code ?? null) === (it.subject_code ?? null))
      if (idx === -1) return it
      const [match] = fresh.splice(idx, 1)
      return { ...it, id: match.id }
    }),
  }
}

export default function Editor() {
  const info = useClass()
  const { day = '' } = useParams()
  const qc = useQueryClient()
  const [formKey, setFormKey] = useState(0)
  // Always start from the server copy: a cached page could be older than the last autosave.
  const page = useQuery({
    queryKey: ['card', info.code, day],
    queryFn: () => api.get<CardPage>(classPath(info.code, `/cards/${day}`)),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })
  const { t } = useTranslation()
  if (page.isLoading || (!page.isFetchedAfterMount && page.isFetching)) return <Spinner />
  if (page.error) return <ErrorBox error={page.error} onRetry={() => page.refetch()} />
  const data = page.data!
  if (!data.state.can_write) {
    return (
      <Box>
        <EmptyState title={t('editor.not_allowed')} text={t('editor.not_allowed_sub')}>
          <Link to={`/c/${info.code}`} className="font-semibold text-bordeaux underline">
            {t('nav.today')}
          </Link>
        </EmptyState>
      </Box>
    )
  }
  const reload = (card: Card | null) => {
    qc.setQueryData<CardPage>(['card', info.code, day], (old) => (old ? { ...old, card } : old))
    setFormKey((k) => k + 1)
  }
  return <EditorForm key={`${day}-${formKey}`} day={day} page={data} onReload={reload} />
}

function EditorForm({ day, page, onReload }: { day: string; page: CardPage; onReload: (card: Card | null) => void }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [state, setState] = useState<EditorState>(() => initialState(page))
  const stateRef = useRef(state)
  const versionRef = useRef(0)
  const savedVersionRef = useRef(page.card ? 0 : -1)
  const [version, setVersion] = useState(0)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [save, setSave] = useState<SaveStatus>(page.card ? { kind: 'saved', at: page.card.updated_at } : { kind: 'idle' })
  const [published, setPublished] = useState(page.card?.status === 'published')
  const [preview, setPreview] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [form, setForm] = useState<ItemInput | null>(null)
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const revisionRef = useRef(page.card?.revision ?? 0)
  const conflictRef = useRef(false)
  const discardRef = useRef(false)
  const [conflict, setConflict] = useState<Card | null>(null)

  const update = useCallback((fn: (s: EditorState) => EditorState) => {
    const next = fn(stateRef.current)
    stateRef.current = next
    setState(next)
    versionRef.current += 1
    setVersion(versionRef.current)
  }, [])

  const saveNow = useCallback((force = false) => {
    const run = async () => {
      const v = versionRef.current
      if (v === savedVersionRef.current) return
      // Opening the editor must not create a draft: others would see "is writing".
      if (v === 0 && !force) return
      if (discardRef.current || (conflictRef.current && !force)) return
      setSave({ kind: 'saving' })
      try {
        const card = await api.put<Card>(classPath(info.code, `/cards/${day}`), toPayload(stateRef.current, revisionRef.current))
        savedVersionRef.current = v
        revisionRef.current = card.revision
        const withIds = assignIds(stateRef.current, card)
        stateRef.current = withIds
        setState(withIds)
        setSave({ kind: 'saved', at: card.updated_at })
        qc.setQueryData<CardPage>(['card', info.code, day], (old) => (old ? { ...old, card } : old))
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          const server = (e.detail as { card?: Card | null } | undefined)?.card ?? null
          conflictRef.current = true
          setConflict(server ?? ({ revision: 0 } as Card))
        }
        setSave({ kind: 'error', msg: (e as Error).message })
        throw e
      }
    }
    chain.current = chain.current.catch(() => undefined).then(run)
    return chain.current
  }, [info.code, day, qc])

  const keepMine = () => {
    revisionRef.current = conflict?.revision ?? 0
    conflictRef.current = false
    setConflict(null)
    saveNow(true).catch(() => undefined)
  }

  const loadSaved = () => {
    if (!window.confirm(t('editor.conflict_reload_confirm'))) return
    discardRef.current = true
    onReload(conflict && conflict.id ? conflict : null)
  }

  useEffect(() => {
    if (version === 0) return
    const id = setTimeout(() => saveNow().catch(() => undefined), 1800)
    return () => clearTimeout(id)
  }, [version, saveNow])

  useEffect(() => () => void saveNow().catch(() => undefined), [saveNow])

  const setEntry = (key: string, patch: Partial<EntryDraft>) =>
    update((s) => ({ ...s, entries: s.entries.map((e) => (e.key === key ? { ...e, ...patch } : e)) }))

  const publish = async () => {
    setPublishError(null)
    setPublishing(true)
    try {
      await saveNow(true)
      await api.post(classPath(info.code, `/cards/${day}/publish`))
      setPublished(true)
      qc.removeQueries({ queryKey: ['card', info.code, day] })
      await qc.invalidateQueries()
      navigate(day === todayIso() ? `/c/${info.code}` : `/c/${info.code}/giorno/${day}`)
    } catch (e) {
      setPublishError((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  const blockCodes = new Set(state.entries.map((e) => e.subject_code))
  const firstBlockOf = new Map<string, string>()
  state.entries.forEach((e) => !firstBlockOf.has(e.subject_code) && firstBlockOf.set(e.subject_code, e.key))
  const otherItems = state.items.filter((i) => !i.subject_code || !blockCodes.has(i.subject_code))

  const submitItem = (item: ItemInput) => {
    update((s) => {
      if (item.key && s.items.some((i) => i.key === item.key)) {
        return { ...s, items: s.items.map((i) => (i.key === item.key ? item : i)) }
      }
      return { ...s, items: [...s.items, { ...item, key: newKey() }] }
    })
    setForm(null)
    if (draftKey) setDraftKey(null)
  }
  const removeItem = (key?: string) => update((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) }))

  if (preview) {
    const me = info.viewer.member
    const payload = toPayload(state)
    const card: Card = {
      id: 0, day, status: 'draft', author: me, scribe: null, notes: state.notes, revision: 0, published_at: null, updated_at: null,
      entries: payload.entries,
      items: state.items.map((i, idx) => ({
        ...i, id: i.id ?? -idx - 1, author: me, status: 'draft', card_day: day, attachment_id: i.attachment_id ?? null,
      })),
      attachments: state.attachment_ids.map((id) => ({ id, width: 0, height: 0 })),
    }
    return (
      <div className="space-y-4 pb-24">
        <h1 className="text-xl font-extrabold">{t('editor.preview_title')}</h1>
        <DayCardView card={card} subjects={info.subjects} classLabel={info.label} />
        <ActionBar save={save} published={published} onPreview={() => setPreview(false)} previewLabel={t('editor.back_edit')} onPublish={publish} publishing={publishing} error={publishError} />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <Link to={`/c/${info.code}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {t('nav.today')}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('editor.title', { day: longDay(day, lang) })}</h1>
        <p className="mt-1 text-sm text-muted">{t('editor.subtitle')}</p>
      </div>

      {conflict && (
        <div className="rounded-2xl border border-rosa/30 bg-rosa-soft p-4" role="alert">
          <p className="font-bold text-rosa-ink">{t('editor.conflict_title')}</p>
          <p className="mt-1 text-sm">{t('editor.conflict_text')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={keepMine}>{t('editor.conflict_keep')}</Button>
            <Button size="sm" variant="secondary" onClick={loadSaved}>{t('editor.conflict_reload')}</Button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t('editor.lessons')}</h2>
        {state.entries.length === 0 && <p className="text-sm text-muted">{t('editor.no_lessons')}</p>}
        {state.entries.map((entry) => (
          <EntryEditor
            key={entry.key}
            entry={entry}
            onChange={(patch) => setEntry(entry.key, patch)}
            onRemove={() => update((s) => ({ ...s, entries: s.entries.filter((e) => e.key !== entry.key) }))}
            items={firstBlockOf.get(entry.subject_code) === entry.key ? state.items.filter((i) => i.subject_code === entry.subject_code) : []}
            onAddItem={(type) => setForm(emptyItem(type, entry.subject_code, page.next_lessons, day))}
            onEditItem={(item) => setForm(item)}
            onRemoveItem={(item) => removeItem(item.key)}
          />
        ))}
        <AddSubject
          onAdd={(code) =>
            update((s) => ({ ...s, entries: [...s.entries, { key: newKey(), subject_code: code, hours: '', room: '', is_lab: false, lesson_status: 'svolta', bullets: [''], lab: null, attachment_ids: [] }] }))
          }
        />
      </section>

      <AiSources
        day={day}
        onAttach={(id) => update((s) => ({ ...s, attachment_ids: [...s.attachment_ids, id] }))}
        onAccept={(d, attachmentId) =>
          update((s) => ({ ...s, items: [...s.items, { key: newKey(), type: d.type, subject_code: d.subject_code, title: d.title, due_date: d.due_date, due_time: d.due_time, source: d.source, link: '', attachment_id: attachmentId }] }))
        }
        onEdit={(d, attachmentId) => setForm({ type: d.type, subject_code: d.subject_code, title: d.title, due_date: d.due_date, due_time: d.due_time, source: d.source, link: '', attachment_id: attachmentId })}
      />

      {otherItems.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t('editor.other_items')}</h2>
          <div className="space-y-2">
            {otherItems.map((it) => (
              <ItemChip key={it.key} item={it} onEdit={() => setForm(it)} onRemove={() => removeItem(it.key)} />
            ))}
          </div>
        </section>
      )}

      {state.attachment_ids.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t('editor.attachments')}</h2>
          <div className="flex flex-wrap gap-2">
            {state.attachment_ids.map((id) => (
              <div key={id} className="relative">
                <img src={attachmentUrl(id)} alt="" className="h-24 rounded-lg border border-line object-cover" />
                <button
                  onClick={() => update((s) => ({ ...s, attachment_ids: s.attachment_ids.filter((a) => a !== id) }))}
                  className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white"
                  aria-label={t('editor.remove_item')}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <label htmlFor="notes" className="mb-2 block text-sm font-bold uppercase tracking-wide text-muted">
          {t('editor.notes_title')}
        </label>
        <textarea
          id="notes"
          rows={3}
          className={inputClass}
          placeholder={t('editor.notes_ph')}
          value={state.notes}
          maxLength={1500}
          onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))}
        />
      </section>

      <ActionBar save={save} published={published} onPreview={() => setPreview(true)} previewLabel={t('editor.preview')} onPublish={publish} publishing={publishing} error={publishError} />

      <ItemForm
        key={form ? form.key ?? String(form.id ?? 'new') : 'closed'}
        open={form !== null}
        initial={form}
        subjects={info.subjects}
        nextLessons={page.next_lessons}
        baseDay={day}
        onClose={() => setForm(null)}
        onSubmit={submitItem}
      />
    </div>
  )
}

function EntryEditor({
  entry, onChange, onRemove, items, onAddItem, onEditItem, onRemoveItem,
}: {
  entry: EntryDraft
  onChange: (p: Partial<EntryDraft>) => void
  onRemove: () => void
  items: ItemInput[]
  onAddItem: (type: ItemType) => void
  onEditItem: (item: ItemInput) => void
  onRemoveItem: (item: ItemInput) => void
}) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  useEffect(() => {
    if (focusIdx !== null) {
      refs.current[focusIdx]?.focus()
      setFocusIdx(null)
    }
  }, [focusIdx, entry.bullets.length])

  const setBullet = (i: number, v: string) => onChange({ bullets: entry.bullets.map((b, j) => (j === i ? v : b)) })
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (entry.bullets.length < 5) {
        const next = [...entry.bullets]
        next.splice(i + 1, 0, '')
        onChange({ bullets: next })
        setFocusIdx(i + 1)
      }
    } else if (e.key === 'Backspace' && !entry.bullets[i] && entry.bullets.length > 1) {
      e.preventDefault()
      onChange({ bullets: entry.bullets.filter((_, j) => j !== i) })
      setFocusIdx(Math.max(0, i - 1))
    }
  }
  const color = subjectColor(info.subjects, entry.subject_code)
  const skipped = entry.lesson_status === 'non_svolta'
  const lab = entry.lab ?? emptyLab()
  const setLab = (patch: Partial<LabData>) => onChange({ lab: { ...lab, ...patch } })

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white" style={{ borderLeftColor: color, borderLeftWidth: 5 }}>
      <header className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <h3 className="font-bold">{subjectName(info.subjects, entry.subject_code, i18n.language)}</h3>
        {entry.hours && <span className="text-xs text-muted">{entry.hours.includes('-') ? t('day.hours', { h: entry.hours }) : t('day.hour', { h: entry.hours })}</span>}
        {entry.room && <span className="text-xs text-muted">· {entry.room}</span>}
        {entry.is_lab && <Badge className="bg-verde-soft text-verde-ink">{t('day.lab')}</Badge>}
        <select
          value={entry.lesson_status}
          onChange={(e) => onChange({ lesson_status: e.target.value as LessonStatus })}
          className="ml-auto rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold"
          aria-label={t('editor.lessons')}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`day.status_${s}`)}
            </option>
          ))}
        </select>
        <button onClick={onRemove} className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-rosa-ink" aria-label={t('editor.remove_subject')} title={t('editor.remove_subject')}>
          <Trash2 className="size-4" />
        </button>
      </header>

      <div className="space-y-3 px-4 pb-4 pt-2">
        {!skipped && (
          <>
            <ul className="space-y-1.5">
              {entry.bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-muted/60" aria-hidden />
                  <input
                    ref={(el) => {
                      refs.current[i] = el
                    }}
                    className="w-full border-0 border-b border-transparent bg-transparent py-1.5 text-[15px] placeholder:text-muted/60 focus:border-azzurro focus:outline-none"
                    placeholder={t('editor.bullet_ph')}
                    value={b}
                    maxLength={300}
                    onChange={(e) => setBullet(i, e.target.value)}
                    onKeyDown={(e) => onKey(i, e)}
                  />
                </li>
              ))}
            </ul>
            {entry.bullets.length < 5 ? (
              <button
                onClick={() => {
                  onChange({ bullets: [...entry.bullets, ''] })
                  setFocusIdx(entry.bullets.length)
                }}
                className="text-sm font-semibold text-muted hover:text-ink"
              >
                + {t('editor.add_bullet')}
              </button>
            ) : (
              <p className="text-xs text-muted">{t('editor.max_bullets')}</p>
            )}

            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-4 accent-verde" checked={entry.is_lab} onChange={(e) => onChange({ is_lab: e.target.checked, lab: e.target.checked ? lab : entry.lab })} />
              <FlaskConical className="size-4 text-verde-ink" /> {t('editor.lab_toggle')}
            </label>
            {entry.is_lab && (
              <div className="grid gap-2 rounded-xl border border-verde/30 bg-verde-soft p-3 sm:grid-cols-2">
                <LabInput label={t('day.lab_goal')} value={lab.goal} placeholder={t('editor.lab_goal_ph')} onChange={(v) => setLab({ goal: v })} />
                <LabInput label={t('day.lab_repo')} value={lab.repo_url} placeholder={t('editor.lab_repo_ph')} onChange={(v) => setLab({ repo_url: v })} />
                <LabInput label={t('day.lab_pitfall')} value={lab.pitfall} placeholder={t('editor.lab_pitfall_ph')} onChange={(v) => setLab({ pitfall: v })} mono />
                <LabInput label={t('day.lab_bring')} value={lab.bring} placeholder={t('editor.lab_bring_ph')} onChange={(v) => setLab({ bring: v })} />
              </div>
            )}
          </>
        )}

        <div className="border-t border-dashed border-line pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('editor.assigned_today')}</p>
          {items.length > 0 && (
            <div className="mb-2 space-y-2">
              {items.map((it) => (
                <ItemChip key={it.key} item={it} onEdit={() => onEditItem(it)} onRemove={() => onRemoveItem(it)} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {QUICK_TYPES.map((ty) => {
              const Icon = TYPE_STYLE[ty].icon
              return (
                <button key={ty} onClick={() => onAddItem(ty)} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${TYPE_STYLE[ty].badge} hover:brightness-95`}>
                  <Plus className="size-3.5" />
                  <Icon className="size-4" /> {t(`editor.add_${ty}`)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
}

function LabInput({ label, value, placeholder, onChange, mono }: { label: string; value: string; placeholder: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs font-bold text-verde-ink">{label}</span>
      <input className={`${inputClass} py-2 text-sm ${mono ? 'font-mono' : ''}`} value={value} placeholder={placeholder} maxLength={300} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function ItemChip({ item, onEdit, onRemove }: { item: ItemInput; onEdit: () => void; onRemove: () => void }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-paper/60 px-3 py-2">
      <button onClick={onEdit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
        <TypeBadge type={item.type} />
        <SubjectTag subjects={info.subjects} code={item.subject_code} />
        <span className="min-w-0 truncate font-semibold">{item.title}</span>
        <span className="text-xs text-muted">{relativeDay(item.due_date, t, i18n.language)}</span>
      </button>
      <button onClick={onRemove} className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-rosa-ink" aria-label={t('editor.remove_item')}>
        <X className="size-4" />
      </button>
    </div>
  )
}

function AddSubject({ onAdd }: { onAdd: (code: string) => void }) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line py-3 text-sm font-semibold text-muted hover:border-ink/30 hover:text-ink" title={t('editor.add_subject_title')}>
        <Plus className="size-4" /> {t('editor.add_subject')}
      </button>
    )
  }
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-3">
      {info.subjects.map((s) => (
        <button
          key={s.code}
          onClick={() => {
            onAdd(s.code)
            setOpen(false)
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold hover:border-ink/40"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
          {subjectName(info.subjects, s.code, i18n.language)}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="p-2 text-muted" aria-label={t('common.cancel')}>
        <X className="size-4" />
      </button>
    </div>
  )
}

type OcrResult = { status: string; drafts: Draft[]; message: string; provider: string }

function AiSources({
  day, onAttach, onAccept, onEdit,
}: {
  day: string
  onAttach: (id: number) => void
  onAccept: (d: Draft, attachmentId: number | null) => void
  onEdit: (d: Draft, attachmentId: number | null) => void
}) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<(Draft & { key: string })[]>([])
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [attachmentId, setAttachmentId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (body: { text?: string; attachment_id?: number }) => {
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const { job_id } = await api.post<{ job_id: string }>(classPath(info.code, '/ocr'), { ...body, day })
      let result: OcrResult | null = null
      for (let i = 0; i < 90; i++) {
        result = await api.get<OcrResult>(classPath(info.code, `/ocr/${job_id}`))
        if (result.status === 'done' || result.status === 'error') break
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!result || result.status !== 'done') throw new Error(result?.message || t('common.error'))
      setDrafts(result.drafts.map((d) => ({ ...d, key: newKey() })))
      setMessage(result.message)
      setDone(result.drafts.length === 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const upload = async (file: File) => {
    if (!privacy) {
      setError(t('editor.privacy_needed'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('privacy_ok', 'true')
      const att = await api.post<{ id: number }>(classPath(info.code, '/attachments'), fd)
      onAttach(att.id)
      setAttachmentId(att.id)
      await run({ attachment_id: att.id })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const drop = (key: string) => setDrafts((ds) => ds.filter((d) => d.key !== key))

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <Sparkles className="size-5 text-viola" /> {t('editor.sources_title')}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{t('editor.sources_sub')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea rows={2} className={`${inputClass} flex-1`} placeholder={t('editor.paste_ph')} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <Button variant="secondary" onClick={() => { setAttachmentId(null); run({ text }) }} disabled={!text.trim()} loading={busy && !!text} className="sm:self-start">
          <Sparkles className="size-4" /> {t('editor.read_ai')}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-bordeaux" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          {t('editor.privacy_check')}
        </label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        <Button variant="secondary" size="sm" onClick={() => (privacy ? fileRef.current?.click() : setError(t('editor.privacy_needed')))} disabled={busy}>
          <ImagePlus className="size-4" /> {t('editor.upload')}
        </Button>
      </div>
      {busy && <p className="mt-3 text-sm font-medium text-viola-ink">{t('editor.reading')}</p>}
      {error && <p className="mt-3 text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
      {message && <p className="mt-3 rounded-lg bg-giallo-soft px-3 py-2 text-xs">{message}</p>}
      {done && !busy && <p className="mt-3 text-sm text-muted">{t('editor.no_drafts')}</p>}
      {drafts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('editor.drafts_title')}</p>
            <button
              className="text-sm font-semibold text-bordeaux"
              onClick={() => {
                drafts.forEach((d) => onAccept(d, attachmentId))
                setDrafts([])
              }}
            >
              {t('editor.accept_all')}
            </button>
          </div>
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.key} className={`rounded-xl border p-3 ${d.needs_check ? 'border-giallo bg-giallo-soft' : 'border-line bg-paper/60'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={d.type} />
                  <SubjectTag subjects={info.subjects} code={d.subject_code} />
                  <SourceBadge source={d.source} />
                  <span className="text-xs font-semibold">{capitalize(relativeDay(d.due_date, t, i18n.language))}{d.due_time ? ` · ${d.due_time}` : ''}</span>
                  {d.needs_check && <Badge className="bg-giallo text-ink">{t('editor.check_date')}</Badge>}
                </div>
                <p className="mt-1 font-semibold">{d.title}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => { onAccept(d, attachmentId); drop(d.key) }}>{t('editor.accept')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => { onEdit(d, attachmentId); drop(d.key) }}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => drop(d.key)}>{t('editor.discard')}</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ActionBar({
  save, published, onPreview, previewLabel, onPublish, publishing, error,
}: {
  save: SaveStatus
  published: boolean
  onPreview: () => void
  previewLabel: string
  onPublish: () => void
  publishing: boolean
  error: string | null
}) {
  const { t, i18n } = useTranslation()
  const status =
    save.kind === 'saving' ? t('editor.saving')
      : save.kind === 'saved' ? t(published ? 'editor.saved_published' : 'editor.saved', { time: timeOf(save.at, i18n.language) })
        : save.kind === 'error' ? t('editor.save_error', { msg: save.msg })
          : ''
  return (
    <div className="fixed inset-x-0 bottom-[4.4rem] z-20 border-t border-line bg-white/95 backdrop-blur md:bottom-0 md:left-60">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
        <p className={`min-w-0 flex-1 truncate text-xs ${save.kind === 'error' ? 'font-semibold text-rosa-ink' : 'text-muted'}`}>{error ?? status}</p>
        <Button variant="secondary" size="sm" onClick={onPreview}>
          <Eye className="size-4" /> {previewLabel}
        </Button>
        <Button size="sm" onClick={onPublish} loading={publishing}>
          {published ? t('editor.republish') : t('editor.publish')}
        </Button>
      </div>
    </div>
  )
}
