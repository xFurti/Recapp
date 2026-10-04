import { Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from './ui'

/** Mount for each confirmation. Native modality supplies focus containment and an inert background. */
export function ConfirmationDialog({ title, description, children, confirmLabel, pendingLabel, errorLabel, onConfirm, onClose, icon, iconClassName = 'bg-rosa-soft text-rosa-ink', confirmVariant = 'danger' }: {
  title: string
  description: string
  children?: ReactNode
  confirmLabel: string
  pendingLabel: string
  errorLabel: string
  onConfirm: () => Promise<unknown>
  onClose: (confirmed: boolean) => void
  icon?: ReactNode
  iconClassName?: string
  confirmVariant?: 'danger' | 'primary'
}) {
  const { t } = useTranslation()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const locked = useRef(false)
  const confirmed = useRef(false)
  const [pending, setPending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    cancel.current?.focus()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (!confirmed.current && opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    if (error && !pending) cancel.current?.focus()
  }, [error, pending])

  const dismiss = () => {
    if (locked.current) return
    locked.current = true
    setClosing(true)
  }
  const confirm = async () => {
    if (locked.current) return
    locked.current = true
    setPending(true)
    setError(false)
    // Keep keyboard focus inside the dialog while all actions are disabled.
    dialog.current?.focus()
    try {
      await onConfirm()
      confirmed.current = true
      setClosing(true)
    } catch (caught) {
      locked.current = false
      setPending(false)
      if (caught instanceof Error && caught.name === 'ActionUnavailable') {
        setUnavailable(caught.message)
        cancel.current?.focus()
        return
      }
      setError(true)
    }
  }

  return createPortal(
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      aria-describedby={children != null ? `${id}-description ${id}-preview` : `${id}-description`}
      aria-modal="true"
      className="confirmation-dialog rounded-3xl border border-line bg-surface p-5 text-ink shadow-2xl sm:p-6"
      data-closing={closing || undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const actions = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        const first = actions[0]
        const last = actions.at(-1)
        if (!first || closing || pending) {
          event.preventDefault()
          dialog.current?.focus()
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
          event.preventDefault()
          first.focus()
        }
      }}
      onCancel={(event) => { event.preventDefault(); dismiss() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss()
      }}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget && event.animationName === 'confirmation-out') {
          event.currentTarget.close()
          onClose(confirmed.current)
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}>
          {icon ?? <Trash2 className="size-6" aria-hidden />}
        </span>
        <button type="button" disabled={pending || closing} onClick={dismiss} aria-label={t('common.close')} className="confirmation-action flex size-11 items-center justify-center rounded-full text-muted hover:bg-ink/5 disabled:opacity-40">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <h2 id={`${id}-title`} className="language-text mt-4 text-xl font-bold">{title}</h2>
      <p id={`${id}-description`} className="language-text mt-2 text-sm text-muted">{description}</p>
      {children != null && (
        <div id={`${id}-preview`} className="mt-4 rounded-xl border border-line bg-paper p-3 text-[15px]">
          {children}
        </div>
      )}
      <p role="status" className="mt-3 text-sm text-muted">{pending && <span className="language-text">{pendingLabel}</span>}</p>
      {unavailable && <p role="alert" className="mt-3 text-sm font-medium text-rosa-ink">{unavailable}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-rosa-ink"><span className="language-text">{errorLabel}</span></p>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button ref={cancel} type="button" disabled={pending || closing} onClick={dismiss} className="confirmation-action h-11 rounded-xl border border-line px-4 font-semibold hover:bg-ink/5 disabled:opacity-40">
          <span className="language-text">{unavailable ? t('common.close') : t('common.cancel')}</span>
        </button>
        {!unavailable && (
          <Button type="button" variant={confirmVariant} loading={pending} disabled={closing} onClick={confirm} className="confirmation-action">
            <span className="language-text">{pending ? pendingLabel : confirmLabel}</span>
          </Button>
        )}
      </div>
    </dialog>,
    document.body,
  )
}
