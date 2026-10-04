import { TriangleAlert, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from './ui'

/** Shown only when Publish is pressed on a summary that has nothing the server would accept. */
export function EmptyPublishDialog({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const done = useRef(false)
  const finished = useRef(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    element.querySelector<HTMLButtonElement>('[data-complete]')?.focus()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (!done.current && opener?.isConnected) opener.focus()
    }
  }, [])

  const end = () => {
    if (finished.current) return
    finished.current = true
    if (done.current) onComplete()
    else onClose()
  }

  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(end, 400)
    return () => window.clearTimeout(id)
  }, [closing])

  const dismiss = () => {
    if (closing) return
    setClosing(true)
  }
  const finish = () => {
    if (closing) return
    done.current = true
    setClosing(true)
  }

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      aria-modal="true"
      className="confirmation-dialog rounded-3xl border border-line bg-surface p-5 text-ink shadow-2xl sm:p-6"
      data-closing={closing || undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || !closing) return
        end()
      }}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rosa-soft text-rosa-ink" aria-hidden>
          <TriangleAlert className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-lg font-extrabold leading-snug">{t('editor.empty_title')}</h2>
          <p id={`${id}-body`} className="mt-2 text-sm leading-relaxed text-muted">{t('editor.empty_body')}</p>
        </div>
        <button type="button" onClick={dismiss} className="rounded-full p-2 text-muted hover:bg-ink/5 hover:text-ink" aria-label={t('common.close')}>
          <X className="size-5" />
        </button>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={dismiss}>{t('common.close')}</Button>
        <Button type="button" data-complete onClick={finish}>{t('editor.empty_complete')}</Button>
      </div>
    </dialog>,
    document.body,
  )
}
