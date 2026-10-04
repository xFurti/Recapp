import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { emptyItem, ItemForm, type ItemInput } from '../components/ItemForm'
import { ItemRow, TYPE_STYLE } from '../components/items'
import { Button, Card, Chip, EmptyState, ErrorBox, Segmented, Spinner, useDismiss } from '../components/ui'
import { useDone } from '../lib/done'
import { capitalize, relativeDay, shortDay, subjectColor, subjectName } from '../lib/format'
import { classPath, useClass, useToday } from '../queries'
import type { Item, ItemType, Subject } from '../types'

type Range = 'week' | 'next' | 'all'
type SubjectFilter = 'all' | 'none' | string
const TYPES: ItemType[] = ['compito', 'verifica', 'evento', 'lab']

function groupByDay(items: Item[]): [string, Item[]][] {
  const map = new Map<string, Item[]>()
  for (const it of items) {
    const list = map.get(it.due_date) ?? []
    list.push(it)
    map.set(it.due_date, list)
  }
  return [...map.entries()]
}

function SubjectFilterMenu({
  value, label, dot, subjects, onChange,
}: {
  value: SubjectFilter
  label: string
  dot: string
  subjects: Subject[]
  onChange: (value: SubjectFilter) => void
}) {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const pick = (next: SubjectFilter) => {
    onChange(next)
    close()
  }
  const option = 'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold'
  const chosen = (on: boolean) => `${option} ${on ? 'bg-ink text-paper' : 'hover:bg-ink/5'}`
  return (
    <div className="relative mt-3" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('upcoming.subject')}
        className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold hover:border-ink/30"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label={t('upcoming.subject')} className="absolute z-20 mt-2 max-h-80 w-64 max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          <li>
            <button type="button" role="option" aria-selected={value === 'all'} onClick={() => pick('all')} className={chosen(value === 'all')}>
              <span className="size-2 rounded-full border border-current" aria-hidden />
              <span className="language-text">{t('subject.all_subjects')}</span>
            </button>
          </li>
          <li>
            <button type="button" role="option" aria-selected={value === 'none'} onClick={() => pick('none')} className={chosen(value === 'none')}>
              <span className="size-2 rounded-full border border-dashed border-current" aria-hidden />
              <span className="language-text">{t('upcoming.no_subject')}</span>
            </button>
          </li>
          {subjects.map((s) => (
            <li key={s.code}>
              <button type="button" role="option" aria-selected={value === s.code} onClick={() => pick(s.code)} className={chosen(value === s.code)}>
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                {subjectName(info.subjects, s.code, i18n.language)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Upcoming() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [type, setType] = useState<ItemType | null>(null)
  const [range, setRange] = useState<Range>('all')
  const [subject, setSubject] = useState<SubjectFilter>('all')
  const [showPast, setShowPast] = useState(false)
  const [form, setForm] = useState<ItemInput | null>(null)
  const { done, toggle } = useDone(info.code)
  const today = useToday(info.code)
  const nextLessons = today.data?.next_lessons ?? {}
  const canAdd = !info.viewer.read_only

  const qs = `?range=${range}${type ? `&type=${type}` : ''}`
  const list = useQuery({ queryKey: ['upcoming', info.code, range, type], queryFn: () => api.get<Item[]>(classPath(info.code, `/upcoming${qs}`)) })
  const past = useQuery({
    queryKey: ['upcoming', info.code, 'past', type],
    queryFn: () => api.get<Item[]>(classPath(info.code, `/upcoming?range=past${type ? `&type=${type}` : ''}`)),
    enabled: showPast,
  })

  const refresh = () => qc.invalidateQueries({ predicate: (q) => ['upcoming', 'today', 'card'].includes(String(q.queryKey[0])) })
  const saveItem = useMutation({
    mutationFn: (item: ItemInput) => {
      const body = { type: item.type, subject_code: item.subject_code, title: item.title, due_date: item.due_date, due_time: item.due_time, source: item.source, link: item.link }
      return item.id ? api.patch(classPath(info.code, `/upcoming/${item.id}`), body) : api.post(classPath(info.code, '/upcoming'), body)
    },
    onSuccess: () => {
      setForm(null)
      refresh()
    },
  })
  const deleteItem = useMutation({
    mutationFn: (id: number) => api.del(classPath(info.code, `/upcoming/${id}`)),
    onSuccess: () => {
      setForm(null)
      refresh()
    },
  })

  const openEdit = (it: Item) =>
    setForm({ id: it.id, type: it.type, subject_code: it.subject_code, title: it.title, due_date: it.due_date, due_time: it.due_time, source: it.source, link: it.link })

  const bySubject = (items: Item[]) => items.filter((it) => {
    if (subject === 'all') return true
    if (subject === 'none') return !it.subject_code
    return it.subject_code === subject
  })
  const visible = bySubject(list.data ?? [])
  const pastVisible = bySubject(past.data ?? [])
  const filtersOn = type !== null || range !== 'all' || subject !== 'all'
  const resetFilters = () => {
    setType(null)
    setRange('all')
    setSubject('all')
  }
  const subjectLabel = subject === 'all'
    ? t('subject.by_subject')
    : subject === 'none'
      ? t('upcoming.no_subject')
      : subjectName(info.subjects, subject, i18n.language)
  const subjectDot = subject === 'all' || subject === 'none' ? 'var(--color-line)' : subjectColor(info.subjects, subject)

  const renderGroups = (items: Item[]) =>
    groupByDay(items).map(([day, group]) => {
      const rel = relativeDay(day, t, i18n.language)
      const full = capitalize(shortDay(day, i18n.language))
      return (
      <section key={day}>
        <h2 className="mb-2 mt-5 flex items-baseline gap-2 text-sm font-bold">
          <span>{rel}</span>
          {rel !== full && <span className="font-medium text-muted">{full}</span>}
        </h2>
        <div className="space-y-2">
          {group.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              subjects={info.subjects}
              done={done.has(it.id)}
              onToggleDone={() => toggle(it.id)}
              onOpen={it.can_edit ? () => openEdit(it) : undefined}
            />
          ))}
        </div>
      </section>
      )
    })

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight"><span className="language-text">{t('upcoming.title')}</span></h1>
        {canAdd && (
          <Button onClick={() => setForm(emptyItem(type ?? 'compito', null, nextLessons))} className="max-sm:hidden">
            <Plus className="size-4" /> <span className="language-text">{t('upcoming.add')}</span>
          </Button>
        )}
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={type === null} onClick={() => setType(null)}>
          <span className="language-text">{t('upcoming.all')}</span>
        </Chip>
        {TYPES.map((ty) => {
          const Icon = TYPE_STYLE[ty].icon
          return (
            <Chip key={ty} active={type === ty} onClick={() => setType(ty)}>
              <Icon className="size-4" /> <span className="language-text">{t(`types_plural.${ty}`)}</span>
            </Chip>
          )
        })}
      </div>
      <Segmented
        className="mt-3"
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: t('upcoming.this_week') },
          { value: 'next', label: t('upcoming.next_week') },
          { value: 'all', label: t('upcoming.everything') },
        ]}
      />
      <SubjectFilterMenu
        value={subject}
        label={subjectLabel}
        dot={subjectDot}
        subjects={info.subjects}
        onChange={setSubject}
      />

      {list.isLoading && <Spinner />}
      {list.error && <div className="mt-4"><ErrorBox error={list.error} onRetry={() => list.refetch()} /></div>}
      {list.data && visible.length === 0 && !filtersOn && (
        <Card className="mt-5">
          <EmptyState title={t('upcoming.empty')} text={canAdd ? t('upcoming.empty_sub') : undefined} />
        </Card>
      )}
      {list.data && visible.length === 0 && filtersOn && (
        <Card className="mt-5">
          <EmptyState title={t('upcoming.no_match')}>
            <div className="flex flex-wrap justify-center gap-2">
              {subject !== 'all' && (
                <Button variant="secondary" size="sm" onClick={() => setSubject('all')}><span className="language-text">{t('upcoming.clear_subject')}</span></Button>
              )}
              <Button variant="ghost" size="sm" onClick={resetFilters}><span className="language-text">{t('upcoming.reset_filters')}</span></Button>
            </div>
          </EmptyState>
        </Card>
      )}
      {list.data && visible.length > 0 && renderGroups(visible)}

      <button onClick={() => setShowPast((s) => !s)} className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink" aria-expanded={showPast}>
        <ChevronDown className={`size-4 transition ${showPast ? 'rotate-180' : ''}`} />
        <span className="language-text">{showPast ? t('upcoming.hide_past') : t('upcoming.show_past')}</span>
      </button>
      {showPast && (past.isLoading ? <Spinner /> : <div className="opacity-80">{renderGroups(pastVisible)}</div>)}

      {canAdd && (
        <button
          onClick={() => setForm(emptyItem(type ?? 'compito', null, nextLessons))}
          className="above-tab-bar fixed right-5 z-40 flex size-14 items-center justify-center rounded-full bg-bordeaux text-white shadow-lg sm:hidden"
          aria-label={t('upcoming.add')}
        >
          <Plus className="size-6" />
        </button>
      )}

      <ItemForm
        key={form ? String(form.id ?? 'new') : 'closed'}
        open={form !== null}
        initial={form}
        subjects={info.subjects}
        nextLessons={nextLessons}
        onClose={() => setForm(null)}
        onSubmit={(item) => saveItem.mutate(item)}
        onDelete={form?.id ? () => window.confirm(t('upcoming.delete_confirm')) && deleteItem.mutate(form.id!) : undefined}
        busy={saveItem.isPending || deleteItem.isPending}
        error={(saveItem.error as Error | null)?.message ?? (deleteItem.error as Error | null)?.message}
      />
    </div>
  )
}
