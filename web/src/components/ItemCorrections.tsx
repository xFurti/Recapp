import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, MessageSquareWarning, X } from 'lucide-react'
import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../api'
import { relativeDay, shortDay, subjectName } from '../lib/format'
import { classPath, useClass, useToday } from '../queries'
import { CORRECTION_FIELDS, type CorrectionFields, type CorrectionInboxInfo, type Item, type ItemCorrection, type ItemCorrectionsInfo } from '../types'
import { ItemForm, type ItemInput } from './ItemForm'
import { TypeBadge } from './items'
import { Avatar, Badge, Button, ErrorBox, Field, inputClass, Modal, Spinner } from './ui'

type CorrectionField = typeof CORRECTION_FIELDS[number]
const FIELD_LABELS: Record<CorrectionField, string> = { type: 'type', subject_code: 'subject', title: 'title', due_date: 'when', source: 'source', link: 'link' }

/** 409, 422 and 429 need different advice from a generic failure. */
function errorKey(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 409) return 'item_corrections.conflict_error'
  if (error instanceof ApiError && error.status === 429) return 'item_corrections.rate_limited'
  return fallback
}

const CorrectionPanelContext = createContext<(item: Item, report?: boolean) => void>(() => {})

export function ItemCorrectionsProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<{ item: Item; report: boolean } | null>(null)
  return <CorrectionPanelContext.Provider value={(item, report = false) => setSelected({ item, report })}>
    {children}
    {selected && <ItemCorrectionPanel key={selected.item.id} item={selected.item} report={selected.report} onClose={() => setSelected(null)} />}
  </CorrectionPanelContext.Provider>
}

function useRefreshCorrections() {
  const qc = useQueryClient()
  const { code } = useClass()
  const keyed = (keys: string[]) => ({ predicate: (q: { queryKey: readonly unknown[] }) => keys.includes(String(q.queryKey[0])) && q.queryKey[1] === code })
  // Wait only for the panel's own data; the lists behind it refresh without holding the spinner.
  return () => {
    void qc.invalidateQueries(keyed(['upcoming', 'today', 'card', 'subject']))
    return qc.invalidateQueries(keyed(['item-corrections', 'correction-inbox']))
  }
}

function Status({ request }: { request: Pick<ItemCorrection, 'status' | 'already_fixed'> }) {
  const { t } = useTranslation()
  const tone = request.status === 'pending' ? 'bg-giallo-soft text-ink' : request.status === 'accepted' ? 'bg-verde-soft text-verde-ink' : 'bg-rosa-soft text-rosa-ink'
  return <Badge className={tone}>{t(`item_corrections.${request.already_fixed ? 'already_fixed' : request.status}`)}</Badge>
}

function RequestCard({ request, item, canReview, busy, error, onDecision }: {
  request: ItemCorrection; item: Item; canReview: boolean; busy: boolean; error: string | null
  onDecision: (id: number, action: 'accept' | 'reject' | 'already_fixed', note: string) => void
}) {
  const { t, i18n } = useTranslation()
  const info = useClass()
  const [note, setNote] = useState('')
  const pending = request.status === 'pending'
  const proposedFields = CORRECTION_FIELDS.filter(field => Object.hasOwn(request.proposed, field))
  // While pending, compare with the live item. Once closed, the item may already
  // match (accepted) or have moved on, so show what was proposed instead.
  const different = pending ? proposedFields.filter(field => request.proposed[field] !== item[field]) : proposedFields
  const value = (field: CorrectionField, v: CorrectionFields[typeof field] | undefined) => {
    if (v == null || v === '') return t('item_corrections.empty_value')
    if (field === 'type') return t(`types.${v}`)
    if (field === 'source') return t(`sources.${v}`)
    if (field === 'subject_code') return subjectName(info.subjects, String(v), i18n.language)
    if (field === 'due_date') return shortDay(String(v), i18n.language)
    return v
  }
  return (
    <section className="min-w-0 rounded-2xl border border-line p-4" aria-label={t('item_corrections.request_by', { nick: request.author.nick })}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <Avatar nick={request.author.nick} color={request.author.color} size="sm" />
          <span className="min-w-0 break-words">{request.author.nick}</span>
        </p>
        <Status request={request} />
      </div>
      {different.length > 0 ? (
        <dl className="space-y-3">
          {different.map(field => (
            <div key={field}>
              <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{t(`item_form.${FIELD_LABELS[field]}`)}</dt>
              <dd className={`grid min-w-0 gap-2 text-sm ${pending ? 'sm:grid-cols-2' : ''}`}>
                {pending && <div className="min-w-0 rounded-xl bg-ink/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-muted">{t('item_corrections.current')}</p>
                  <p className="whitespace-pre-wrap break-words text-muted line-through decoration-ink/30 [overflow-wrap:anywhere]">{value(field, item[field])}</p>
                </div>}
                <div className="min-w-0 rounded-xl bg-verde-soft p-3">
                  <p className="mb-1 text-xs font-semibold text-verde-ink">{t('item_corrections.proposed')}</p>
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value(field, request.proposed[field])}</p>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      ) : pending ? <p className="text-sm text-muted">{t('item_corrections.matches')}</p> : null}
      <div className="mt-3 border-t border-line pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('item_corrections.reason')}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{request.reason}</p>
      </div>
      {!pending && (
        <div className="correction-reveal mt-3 text-xs text-muted">
          {request.decided_by && request.decided_at && <p>{t('item_corrections.decided', {
            nick: request.decided_by.nick,
            date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.decided_at)),
          })}</p>}
          {request.decision_note && <blockquote className="mt-2 rounded-xl border-l-4 border-line bg-ink/5 px-3 py-2">
            <p className="font-semibold">{t('item_corrections.decision_note')}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink [overflow-wrap:anywhere]">{request.decision_note}</p>
          </blockquote>}
        </div>
      )}
      {canReview && pending && (
        <div className="mt-4 space-y-3">
          <Field label={t('item_corrections.note')}>
            <textarea className={inputClass} rows={2} value={note} maxLength={500} disabled={busy} onChange={e => setNote(e.target.value)} />
          </Field>
          {error && <ErrorBox error={new Error(error)} />}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onDecision(request.id, different.length ? 'accept' : 'already_fixed', note)} disabled={busy}>
              <Check className="size-4" aria-hidden />{t(different.length ? 'item_corrections.accept' : 'item_corrections.close_fixed')}
            </Button>
            <Button variant="secondary" onClick={() => onDecision(request.id, 'reject', note)} disabled={busy}>
              <X className="size-4" aria-hidden />{t('item_corrections.reject')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export function ItemCorrectionPanel({ item, report = false, onClose }: { item: Item; report?: boolean; onClose: () => void }) {
  const info = useClass()
  const { t } = useTranslation()
  const refresh = useRefreshCorrections()
  const [editing, setEditing] = useState(report)
  const details = useQuery({ queryKey: ['item-corrections', info.code, item.id], queryFn: () => api.get<ItemCorrectionsInfo>(classPath(info.code, `/upcoming/${item.id}/corrections`)) })
  const submit = useMutation({
    mutationFn: ({ proposed, reason }: { proposed: Partial<CorrectionFields>; reason: string }) => {
      return api.post(classPath(info.code, `/upcoming/${item.id}/corrections`), { proposed, reason })
    },
    onSuccess: async () => { await refresh(); setEditing(false) },
  })
  const decision = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: 'accept' | 'reject' | 'already_fixed'; note: string }) => api.post(classPath(info.code, `/upcoming/${item.id}/corrections/${id}/decide`), { action, note }),
    onSuccess: refresh,
    onError: () => { void refresh() },
  })
  const busy = submit.isPending || decision.isPending
  const close = () => { if (!busy) onClose() }
  const data = details.data
  const pendingMine = data?.requests.find(r => r.mine && r.status === 'pending')
  if (editing && data) return (
    <CorrectionProposalForm
      key={`proposal-${pendingMine?.id ?? 'new'}`}
      item={data.item} pending={pendingMine}
      onClose={close} onSubmit={(proposed, reason) => submit.mutate({ proposed, reason })}
      busy={submit.isPending} error={submit.error ? t(errorKey(submit.error, 'item_corrections.send_error')) : null}
    />
  )
  return (
    <Modal open onClose={close} title={t('item_corrections.requests')} wide>
      {details.isLoading && <Spinner />}
      {details.error && <ErrorBox error={details.error} onRetry={() => details.refetch()} />}
      {data && (
        <div className="space-y-4">
          <p className="break-words text-base font-semibold">{data.item.title}</p>
          {data.can_review && <p className="text-sm text-muted">{t('item_corrections.review_hint')}</p>}
          <div className="space-y-3" aria-busy={busy}>
            {[...data.requests].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || a.created_at.localeCompare(b.created_at)).map(request => (
              <RequestCard key={request.id} request={request} item={data.item} canReview={data.can_review} busy={busy}
                error={decision.error && decision.variables?.id === request.id ? t(errorKey(decision.error, 'item_corrections.decision_error')) : null}
                onDecision={(id, action, note) => decision.mutate({ id, action, note })} />
            ))}
          </div>
          {data.item.can_request_correction && <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>{t(pendingMine ? 'item_corrections.edit_request' : 'item_corrections.report')}</Button>}
        </div>
      )}
    </Modal>
  )
}

function CorrectionProposalForm({ item, pending, onClose, onSubmit, busy, error }: {
  item: Item; pending?: ItemCorrection; onClose: () => void
  onSubmit: (proposed: Partial<CorrectionFields>, reason: string) => void
  busy: boolean; error: string | null
}) {
  const info = useClass()
  const today = useToday(info.code)
  // Freeze the opening values. A background refetch must not turn untouched
  // fields into changes or overwrite data edited by someone else meanwhile.
  const [current] = useState<ItemInput>(() => ({ ...item, due_time: null }))
  const [initial] = useState<ItemInput>(() => ({ ...item, ...pending?.proposed, due_time: null }))
  return <ItemForm open initial={initial} subjects={info.subjects} nextLessons={today.data?.next_lessons ?? {}} baseDay={today.data?.day}
    correction={{ current, reason: pending?.reason ?? '', pending: !!pending }}
    onClose={onClose} onSubmit={(input, reason) => {
      const proposed = Object.fromEntries(CORRECTION_FIELDS.filter(field => input[field] !== current[field]).map(field => [field, input[field]]))
      onSubmit(proposed, reason!)
    }} busy={busy} error={error} />
}

export function ItemCorrectionControls({ item }: { item: Item }) {
  const { t } = useTranslation()
  const open = useContext(CorrectionPanelContext)
  const review = item.can_review_corrections && (item.correction_count ?? 0) > 0
  if (!item.can_request_correction && !item.my_correction && !review) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 ${review ? 'mt-2 border-t border-line pt-2' : 'mt-1'}`}>
      {review && <Button variant="soft" size="sm" onClick={() => open(item)}>
        <MessageSquareWarning className="size-4" aria-hidden />
        {item.pending_corrections ? t('item_corrections.pending_count', { count: item.pending_corrections }) : t('item_corrections.requests')}
      </Button>}
      {(item.can_request_correction || item.my_correction) && <button type="button" onClick={() => open(item, !item.my_correction)}
        className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-muted transition-colors hover:text-bordeaux focus-visible:outline-2 focus-visible:outline-bordeaux">
        <MessageSquareWarning className="size-3.5" aria-hidden />
        {t(item.my_correction ? `item_corrections.mine_${item.my_correction.status}` : 'item_corrections.report')}
      </button>}
    </div>
  )
}

export function CorrectionInbox() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const open = useContext(CorrectionPanelContext)
  const inbox = useQuery({ queryKey: ['correction-inbox', info.code], queryFn: () => api.get<CorrectionInboxInfo>(classPath(info.code, '/upcoming/corrections')), enabled: !info.viewer.read_only, refetchInterval: 60_000 })
  if (!inbox.data?.pending_count) return null
  return (
    <section className="notice-warning correction-reveal mt-4 rounded-2xl border p-4">
      <button type="button" className="flex min-h-9 w-full items-center gap-2 text-left text-sm font-bold" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
        <MessageSquareWarning className="size-5 shrink-0" aria-hidden />
        <span className="flex-1">{t('item_corrections.inbox_count', { count: inbox.data.pending_count })}</span>
        <ChevronDown className={`faq-chevron size-4 ${expanded ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div id={listId} className="faq-answer" data-open={expanded} inert={!expanded}>
        <div className="min-h-0 overflow-hidden"><ul className="space-y-1 pt-2">
          {inbox.data.items.map(({ item, pending_count }) => <li key={item.id}><button type="button" onClick={() => open(item)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface/70 p-3 text-left text-sm transition-colors hover:bg-surface">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2"><TypeBadge type={item.type} /><span className="text-xs text-muted">{relativeDay(item.due_date, t, i18n.language)}</span></span>
              <span className="mt-1 block break-words font-semibold">{item.title}</span>
            </span>
            <Badge className="shrink-0 bg-giallo text-[#1d1b1e]">{pending_count}</Badge>
          </button></li>)}
        </ul></div>
      </div>
    </section>
  )
}
