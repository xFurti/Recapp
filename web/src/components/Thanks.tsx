import { useIsMutating, useMutation, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { classPath, useClass } from '../queries'
import type { Item, ThanksState } from '../types'
import { Toast } from './ui'

function Heart({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`t-like-heart ${className}`} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

/**
 * The Grazie toggle: the heart fills (shape, not only color) and bursts once, unless motion is reduced.
 * While a request is running it ignores presses instead of disabling itself, so keyboard focus stays put.
 */
export function ThanksButton({ thanked, onToggle, busy, label, children, small }: {
  thanked: boolean
  onToggle: () => void
  busy?: boolean
  label: string
  children: ReactNode
  small?: boolean
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [burst, setBurst] = useState(false)
  const toggle = () => {
    if (busy) return
    if (!thanked && ref.current) {
      ref.current.querySelectorAll<HTMLElement>('.t-like-particles i').forEach((dot) => {
        const angle = Math.random() * Math.PI * 2
        const dist = (small ? 10 : 14) + Math.random() * 16
        dot.style.setProperty('--px', `${Math.cos(angle) * dist}px`)
        dot.style.setProperty('--py', `${Math.sin(angle) * dist}px`)
        dot.style.setProperty('--pdur', `${480 + Math.random() * 180}ms`)
        dot.style.setProperty('--pdelay', `${Math.random() * 50}ms`)
        dot.style.setProperty('--p-end-scale', `${0.35 + Math.random() * 0.45}`)
        dot.style.setProperty('--psize', `${0.7 + Math.random() * 0.9}`)
      })
      setBurst(true)
      window.setTimeout(() => setBurst(false), 700)
    }
    onToggle()
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-busy={busy || undefined}
      aria-pressed={thanked}
      aria-label={label}
      title={label}
      data-liked={thanked ? 'true' : 'false'}
      className={`t-like inline-flex shrink-0 items-center rounded-full border font-semibold transition-colors ${
        small ? 'min-h-8 gap-1 px-2.5 text-xs' : 'h-9 gap-1.5 px-3 text-sm'
      } ${burst ? 'is-bursting is-popping' : ''} ${thanked ? 'border-rosa bg-rosa-soft text-rosa-ink' : 'border-line text-ink hover:border-rosa/40'}`}
    >
      <span className="t-like-icon">
        <Heart className={small ? 'size-3.5' : 'size-4'} />
        <span className="t-like-particles" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
        </span>
      </span>
      {children}
    </button>
  )
}

/** Grazie on your own content, or for read-only viewers: visible, never a control. */
export function ThanksCount({ count, small }: { count: number; small?: boolean }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 font-semibold text-muted ${small ? 'min-h-8 text-xs' : 'h-9 text-sm'}`} title={t('thanks.received', { count })}>
      <Heart className={small ? 'size-3.5' : 'size-4'} />
      <span className="language-text" aria-hidden>{t('feedback.thanks_count', { count })}</span>
      <span className="language-text sr-only">{t('thanks.received', { count })}</span>
    </span>
  )
}

const ITEM_QUERIES = ['upcoming', 'today', 'card', 'subject', 'item-corrections', 'correction-inbox']

const itemQueries = (code: string) => ({
  predicate: (query: Query) => ITEM_QUERIES.includes(String(query.queryKey[0])) && query.queryKey[1] === code,
})

function patchItem(value: unknown, id: number, state: ThanksState): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((entry) => {
      const patched = patchItem(entry, id, state)
      changed ||= patched !== entry
      return patched
    })
    return changed ? next : value
  }
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (record.id === id && 'due_date' in record && 'can_thank' in record) return { ...record, ...state }
  let changed = false
  const next: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(record)) {
    next[key] = patchItem(entry, id, state)
    changed ||= next[key] !== entry
  }
  return changed ? next : value
}

/** One item, one counter: update it in every cached view of the class at once. */
function patchItemThanks(qc: QueryClient, code: string, id: number, state: ThanksState) {
  for (const query of qc.getQueryCache().findAll(itemQueries(code))) {
    qc.setQueryData(query.queryKey, (old: unknown) => patchItem(old, id, state))
  }
}

export function ItemThanks({ item }: { item: Item }) {
  const { t } = useTranslation()
  const { code } = useClass()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const mutationKey = ['item-thanks', code, item.id]
  const pending = useIsMutating({ mutationKey, exact: true }) > 0
  const current: ThanksState = { thanks: item.thanks ?? 0, thanked: !!item.thanked }
  const toggle = useMutation({
    mutationKey,
    mutationFn: () => api.post<ThanksState>(classPath(code, `/upcoming/${item.id}/thanks`)),
    onMutate: async () => {
      // An older read must not replace the optimistic state while the toggle is pending.
      await qc.cancelQueries(itemQueries(code))
      const before = current
      patchItemThanks(qc, code, item.id, { thanked: !before.thanked, thanks: Math.max(0, before.thanks + (before.thanked ? -1 : 1)) })
      return before
    },
    onSuccess: (state) => patchItemThanks(qc, code, item.id, { thanks: state.thanks, thanked: state.thanked }),
    onError: (e, _, before) => {
      if (before) patchItemThanks(qc, code, item.id, before)
      setError((e as Error).message || t('common.error'))
    },
    onSettled: () => Promise.all([
      qc.invalidateQueries(itemQueries(code)),
      qc.invalidateQueries({ queryKey: ['contributions', code] }),
    ]),
  })
  if (item.status !== 'published') return null
  if (!item.can_thank) return current.thanks > 0 ? <ThanksCount count={current.thanks} small /> : null
  return (
    <>
      <ThanksButton
        small
        thanked={current.thanked}
        busy={pending}
        onToggle={() => {
          // The item can appear twice on Today, or remount while a request is still running.
          // Check the shared cache synchronously, before either copy has time to rerender.
          if (qc.isMutating({ mutationKey, exact: true }) === 0) toggle.mutate()
        }}
        label={t('thanks.item_aria', { title: item.title, count: current.thanks })}
      >
        <span className="language-text tabular-nums">{current.thanks > 0 ? current.thanks : t('feedback.thanks')}</span>
      </ThanksButton>
      <Toast message={error} onDone={() => setError(null)} />
    </>
  )
}
