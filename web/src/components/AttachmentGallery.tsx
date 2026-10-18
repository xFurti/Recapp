import { ChevronLeft, ChevronRight, ImageOff, LoaderCircle, Trash2, ZoomIn } from 'lucide-react'
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { attachmentUrl } from '../api'
import { Modal } from './ui'

function AttachmentImage({ id, alt, thumbnail = false }: { id: number; alt: string; thumbnail?: boolean }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  return (
    <div className={thumbnail ? 'attachment-image attachment-thumb' : 'attachment-image attachment-full'} aria-busy={status === 'loading'}>
      {status !== 'error' && <img key={attempt} src={attachmentUrl(id)} alt={alt} loading={thumbnail ? 'lazy' : 'eager'}
        className={status === 'ready' ? '' : 'opacity-0'} onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />}
      {status === 'loading' && <span className="attachment-image-state" role="status">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
        <span className={thumbnail ? 'sr-only' : 'text-sm'}>{t('common.loading')}</span>
      </span>}
      {status === 'error' && <span className="attachment-image-state" role={thumbnail ? 'status' : 'alert'}>
        <ImageOff className="size-5 shrink-0" aria-hidden />
        <span className="text-xs">{t('day.photo_error')}</span>
        {!thumbnail && <button type="button" className="min-h-11 rounded-lg border border-line bg-surface px-4 text-sm font-semibold hover:border-ink/30"
          onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>{t('common.retry')}</button>}
      </span>}
    </div>
  )
}

/** Presentation only: URLs and the supplied attachment associations stay unchanged. */
export function AttachmentGallery({ ids, title, onRemove }: { ids: number[]; title?: string; onRemove?: (id: number) => void }) {
  const { t } = useTranslation()
  const labelId = useId()
  const [zoom, setZoom] = useState<number | null>(null)
  const viewer = useRef<HTMLDivElement>(null)
  const index = zoom === null ? -1 : ids.indexOf(zoom)
  const open = index >= 0
  const showPhoto = (next: number) => {
    if (next < 0 || next >= ids.length) return
    setZoom(ids[next])
    viewer.current?.closest('[role="dialog"]')?.scrollTo({ top: 0, behavior: 'instant' })
  }
  const onArrow = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    showPhoto(index + (event.key === 'ArrowLeft' ? -1 : 1))
  })
  useEffect(() => {
    if (!open || ids.length < 2) return
    const onKey = (event: KeyboardEvent) => onArrow(event)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, ids.length])
  if (!ids.length) return null
  const label = title ?? t('day.photos')
  return (
    <div className="attachment-gallery mt-3 min-w-0" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-2 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
        <span className="font-semibold">{label}</span>
        <span>{t('day.photo_count', { count: ids.length })}</span>
      </p>
      <ul className="attachment-grid">
        {ids.map((id, position) => (
          <li key={id} className="min-w-0">
            <button type="button" onClick={() => setZoom(id)} className="attachment-open group" aria-label={t('day.photo_open_at', { index: position + 1, count: ids.length })}>
              <AttachmentImage id={id} alt="" thumbnail />
              <span className="flex min-h-8 items-center justify-between gap-1 border-t border-line bg-surface px-2 py-1 text-xs font-semibold text-muted">
                <span>{position + 1} / {ids.length}</span><ZoomIn className="size-3.5 shrink-0 group-hover:text-ink" aria-hidden />
              </span>
            </button>
            {onRemove && <button type="button" onClick={() => onRemove(id)} className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-rosa-soft hover:text-rosa-ink"
              aria-label={t('day.photo_remove_at', { index: position + 1 })}><Trash2 className="size-3.5 shrink-0" aria-hidden /><span>{t('day.photo_remove')}</span></button>}
          </li>
        ))}
      </ul>
      <Modal open={open} onClose={() => setZoom(null)} title={label} wide>
        {open && <div ref={viewer} className="attachment-viewer min-w-0" role="group" aria-roledescription={t('day.photo_gallery')}>
          <div className="mb-3 flex items-center gap-2">
            {ids.length > 1 && <button type="button" className="attachment-step" aria-label={t('day.photo_previous')}
              aria-keyshortcuts="ArrowLeft" aria-disabled={index === 0} onClick={() => showPhoto(index - 1)}><ChevronLeft className="size-5" aria-hidden /></button>}
            <p className="min-w-0 flex-1 text-center text-sm font-semibold text-muted" aria-live="polite" aria-atomic="true">{t('day.photo_position', { index: index + 1, count: ids.length })}</p>
            {ids.length > 1 && <button type="button" className="attachment-step" aria-label={t('day.photo_next')}
              aria-keyshortcuts="ArrowRight" aria-disabled={index === ids.length - 1} onClick={() => showPhoto(index + 1)}><ChevronRight className="size-5" aria-hidden /></button>}
          </div>
          <AttachmentImage key={zoom} id={ids[index]} alt={t('day.photo_position', { index: index + 1, count: ids.length })} />
        </div>}
      </Modal>
    </div>
  )
}
