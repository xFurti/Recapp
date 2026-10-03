import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'

const variants: Record<Variant, string> = {
  primary: 'bg-bordeaux text-white hover:bg-bordeaux-dark shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:border-ink/30',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-surface text-rosa-ink border border-rosa/30 hover:bg-rosa-soft',
  soft: 'bg-bordeaux-soft text-bordeaux hover:bg-bordeaux/15',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]', lg: 'h-13 px-5 text-base' }
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`btn-spring inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  const msg = error instanceof Error ? error.message : t('common.error')
  return (
    <div className="rounded-xl border border-rosa/30 bg-rosa-soft p-4 text-rosa-ink" role="alert">
      <p className="font-medium">{msg}</p>
      {onRetry && (
        <button className="mt-2 text-sm font-semibold underline" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function Avatar({ nick, color, size = 'md' }: { nick: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-7 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase text-white ${sizes[size]}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {nick.slice(0, 1)}
    </span>
  )
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  )
}

const STAIR_COLORS = ['#A02848', '#F8B828', '#1898C8', '#80B830', '#E01058', '#8038B8']

/** The six coloured "stairs" of the Marconi logo, used as a light illustration. */
export function Stairs({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 60" className={className} aria-hidden>
      {STAIR_COLORS.map((c, i) => (
        <path key={c} d={`M${i * 22} 60 v-${18 + i * 7} h10 v-10 h10 v${28 + i * 7} z`} fill={c} />
      ))}
    </svg>
  )
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Stairs className="mb-4 h-12 opacity-80" />
      <p className="text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-muted">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-xl bg-ink/5 p-1 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
        active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink hover:border-ink/40'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  // Portal: an ancestor with backdrop-filter (the sticky header) would trap `fixed` children.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-ink/5" aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Closes a popover on tap/click outside `ref` and on Escape (touch screens have no mouseleave). */
/**
 * Menu anchored to a button, portaled to the body so a clipping parent cannot cut it off.
 * Opens downward, and flips above the button when there is no room.
 */
export function AnchoredMenu({
  open,
  anchorEl,
  onClose,
  children,
}: {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ top: -9999, left: 0, visibility: 'hidden' })

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || anchorEl?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorEl])

  useLayoutEffect(() => {
    if (!open || !anchorEl) return
    const place = () => {
      const menu = menuRef.current
      if (!menu) return
      const anchor = anchorEl.getBoundingClientRect()
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
        onClose()
        return
      }
      const gap = 6
      const width = menu.offsetWidth
      const height = menu.offsetHeight
      // The class pages keep a bottom tab bar on small screens; don't tuck the menu under it.
      const bottomInset = window.innerWidth < 768 ? 80 : 8
      const below = anchor.bottom + gap
      const above = anchor.top - gap - height
      const openAbove = below + height > window.innerHeight - bottomInset && above >= 8
      const top = Math.max(8, openAbove ? above : below)
      const left = Math.min(Math.max(8, anchor.right - width), window.innerWidth - width - 8)
      setStyle({ top, left, visibility: 'visible', transformOrigin: openAbove ? 'bottom right' : 'top right' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorEl, onClose])

  if (!open) return null
  return createPortal(
    <div ref={menuRef} role="menu" style={style} className={`fixed z-50 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-lg ${style.visibility === 'visible' ? 'menu-pop' : ''}`}>
      {children}
    </div>,
    document.body,
  )
}

export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose])
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-azzurro focus:outline-none focus:ring-2 focus:ring-azzurro/20'

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const id = setTimeout(onDone, 2600)
    return () => clearTimeout(id)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status">
      <div className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-lg">{message}</div>
    </div>
  )
}
