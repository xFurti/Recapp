import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bug, ImagePlus, Inbox, Lightbulb, Megaphone, Send, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../api'
import { BODY_MAX, reportDate, TITLE_MAX } from '../lib/report'
import { useMe } from '../queries'
import type { ReportBrief, ReportKind, ReportStatus } from '../types'
import { Button, inputClass, Spinner } from './ui'
import { PageIntro } from './SupportPage'

const IMAGE_MAX = 8 * 1024 * 1024
const KINDS: { value: ReportKind; icon: typeof Bug }[] = [
  { value: 'bug', icon: Bug },
  { value: 'feature', icon: Lightbulb },
]
export function KindIcon({ kind, className = 'size-4' }: { kind: ReportKind; className?: string }) {
  const Icon = kind === 'bug' ? Bug : Lightbulb
  return <Icon className={className} aria-hidden />
}

/** 16px on every screen: below that, iOS zooms the page on focus and leaves it zoomed (#62). */
const fieldClass = `${inputClass.replace('text-[15px]', 'text-base')} aria-[invalid=true]:border-rosa aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rosa/15`

type Errors = Partial<Record<'title' | 'body' | 'image', string>>

/** The status as a small three-step track: new, picked up, closed. */
export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useTranslation()
  const tone = {
    new: 'bg-azzurro-soft text-azzurro-ink',
    in_progress: 'bg-giallo-soft text-ink',
    closed: 'bg-verde-soft text-verde-ink',
  }[status]
  return (
    <span className={`report-status inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`} data-status={status}>
      <span aria-hidden className="report-status-dot" />
      <span className="language-text">{t(`report.status_${status}`)}</span>
    </span>
  )
}

function useMyReports(enabled: boolean) {
  return useQuery({ queryKey: ['reports-mine'], queryFn: () => api.get<ReportBrief[]>('/reports/mine'), enabled })
}

export function ReportBody({ from }: { from: string }) {
  const { t } = useTranslation()
  const me = useMe()
  const member = me.data?.kind === 'member'
  const [fresh, setFresh] = useState<number | null>(null)
  return (
    <div className="support-page report-page">
      <PageIntro icon={Megaphone} title={t('report.title')} description={<span className="language-text">{t('report.intro')}</span>} />
      <ReportForm from={from} member={member} onSent={setFresh} />
      {member && <MyReports fresh={fresh} />}
    </div>
  )
}

function ReportForm({ from, member, onSent }: { from: string; member: boolean; onSent: (id: number) => void }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const ids = useId()
  const [kind, setKind] = useState<ReportKind>('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sentRef = useRef<HTMLDivElement>(null)

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])
  useEffect(() => {
    if (sent) sentRef.current?.focus()
  }, [sent])

  const pick = (file: File | undefined | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, image: t('report.image_not_image') }))
      return
    }
    if (file.size > IMAGE_MAX) {
      setErrors((e) => ({ ...e, image: t('report.image_too_big') }))
      return
    }
    setErrors((e) => ({ ...e, image: undefined }))
    setImage(file)
  }
  const clearImage = () => {
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
    fileRef.current?.focus()
  }
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files[0])
  }

  const validate = (): Errors => {
    const next: Errors = {}
    if (!title.trim()) next.title = t('report.required')
    else if (title.trim().length > TITLE_MAX) next.title = t('report.too_long', { max: TITLE_MAX })
    if (!body.trim()) next.body = t('report.required')
    else if (body.trim().length > BODY_MAX) next.body = t('report.too_long', { max: BODY_MAX })
    return next
  }
  const focusFirst = (found: Errors) => {
    if (found.title) titleRef.current?.focus()
    else if (found.body) bodyRef.current?.focus()
    else if (found.image) fileRef.current?.focus()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFailure(null)
    const found = { ...validate(), image: errors.image }
    if (found.title || found.body) {
      setErrors(found)
      focusFirst(found)
      return
    }
    const data = new FormData()
    data.set('kind', kind)
    data.set('title', title.trim())
    data.set('body', body.trim())
    data.set('page', from)
    data.set('language', i18n.language.startsWith('en') ? 'en' : 'it')
    data.set('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    if (image) data.set('image', image)
    setBusy(true)
    try {
      const created = await api.post<ReportBrief>('/reports', data)
      setTitle('')
      setBody('')
      setImage(null)
      if (fileRef.current) fileRef.current.value = ''
      setErrors({})
      setSent(true)
      if (member) {
        qc.setQueryData<ReportBrief[]>(['reports-mine'], (old) => [created, ...(old ?? []).filter((r) => r.id !== created.id)])
        onSent(created.id)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const field = (error.detail as { field?: string } | undefined)?.field
        if (error.status === 422 && (field === 'title' || field === 'body')) {
          const next = { [field]: t('report.required') }
          setErrors(next)
          focusFirst(next)
        } else if (error.status === 415) {
          setErrors({ image: t('report.image_not_image') })
        } else if (error.status === 413) {
          setErrors({ image: t('report.image_too_big') })
        } else if (error.status === 429) {
          setFailure(t('report.rate_limited'))
        } else {
          setFailure(t('report.error'))
        }
      } else {
        setFailure(t('report.error'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="report-sent report-card support-panel p-6 text-center outline-none sm:p-8">
        <svg viewBox="0 0 52 52" className="report-sent-check mx-auto size-16" aria-hidden>
          <circle cx="26" cy="26" r="24" pathLength={1} />
          <path d="M15 27 l7 7 l15 -16" pathLength={1} />
        </svg>
        <p className="mt-4 text-xl font-extrabold"><span className="language-text">{t('report.sent')}</span></p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          <span className="language-text">{t(member ? 'report.sent_member' : 'report.sent_anonymous')}</span>
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => { setSent(false); setTimeout(() => titleRef.current?.focus(), 0) }}>
          <span className="language-text">{t('report.send_another')}</span>
        </Button>
      </div>
    )
  }

  const errorId = (field: keyof Errors) => `${ids}-${field}-error`
  const helpId = `${ids}-kind-help`
  const describe = (field: keyof Errors, extra?: string) => [extra, errors[field] ? errorId(field) : null].filter(Boolean).join(' ') || undefined
  const titleCount = title.trim().length
  const bodyCount = body.trim().length

  return (
    <form noValidate onSubmit={submit} onPointerMove={spotlight} className="report-card support-panel space-y-6 p-5 sm:p-7">
      <fieldset aria-describedby={helpId}>
        <legend className="mb-2 text-sm font-semibold"><span className="language-text">{t('report.kind_label')}</span></legend>
        <div className="report-kind" data-kind={kind}>
          <span aria-hidden className="report-kind-pill" />
          {KINDS.map(({ value, icon: Icon }) => (
            <label key={value} className="report-kind-option" data-active={kind === value || undefined}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              <Icon className="report-kind-icon size-5" aria-hidden />
              <span className="language-text">{t(`report.kind_${value}`)}</span>
            </label>
          ))}
        </div>
        <p id={helpId} key={kind} className="report-hint mt-2 text-sm text-muted"><span className="language-text">{t(`report.kind_${kind}_help`)}</span></p>
      </fieldset>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <label htmlFor={`${ids}-title`} className="text-sm font-semibold"><span className="language-text">{t('report.title_label')}</span></label>
          <Counter value={titleCount} max={TITLE_MAX} />
        </div>
        <input
          ref={titleRef}
          id={`${ids}-title`}
          className={fieldClass}
          value={title}
          maxLength={TITLE_MAX + 20}
          onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((x) => ({ ...x, title: undefined })) }}
          placeholder={t(`report.title_${kind}_placeholder`)}
          aria-required="true"
          aria-invalid={!!errors.title || undefined}
          aria-describedby={describe('title')}
          enterKeyHint="next"
          autoComplete="off"
        />
        <FieldError id={errorId('title')} message={errors.title} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <label htmlFor={`${ids}-body`} className="text-sm font-semibold"><span className="language-text">{t('report.body_label')}</span></label>
          <Counter value={bodyCount} max={BODY_MAX} />
        </div>
        <textarea
          ref={bodyRef}
          id={`${ids}-body`}
          className={`${fieldClass} min-h-36 resize-y leading-relaxed`}
          rows={6}
          value={body}
          maxLength={BODY_MAX + 100}
          onChange={(e) => { setBody(e.target.value); if (errors.body) setErrors((x) => ({ ...x, body: undefined })) }}
          placeholder={t(`report.body_${kind}_placeholder`)}
          aria-required="true"
          aria-invalid={!!errors.body || undefined}
          aria-describedby={describe('body')}
        />
        <FieldError id={errorId('body')} message={errors.body} />
      </div>

      <div>
        <p id={`${ids}-image-label`} className="mb-1 text-sm font-semibold"><span className="language-text">{t('report.image_label')}</span></p>
        {image && preview ? (
          <div className="report-preview flex items-center gap-3 rounded-2xl border border-line bg-paper p-2.5">
            <img src={preview} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{image.name}</p>
            <button type="button" onClick={clearImage} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-rosa-soft hover:text-rosa-ink" aria-label={t('report.image_remove')}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <label
            className="report-drop flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center"
            data-dragging={dragging || undefined}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <ImagePlus className="report-drop-icon size-7 text-bordeaux" aria-hidden />
            <span className="text-sm font-semibold"><span className="language-text">{t('report.image_pick')}</span></span>
            <span className="hidden text-xs text-muted sm:block"><span className="language-text">{t('report.image_drop')}</span></span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-labelledby={`${ids}-image-label`}
              aria-describedby={[`${ids}-image-privacy`, errors.image ? errorId('image') : ''].filter(Boolean).join(' ')}
              aria-invalid={!!errors.image || undefined}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
        )}
        <p id={`${ids}-image-privacy`} className="mt-1.5 text-xs text-muted"><span className="language-text">{t('report.image_privacy')}</span></p>
        <FieldError id={errorId('image')} message={errors.image} />
      </div>

      {failure && <p role="alert" className="rounded-xl border border-rosa/30 bg-rosa-soft px-3 py-2.5 text-sm font-medium text-rosa-ink"><span className="language-text">{failure}</span></p>}

      <div className="space-y-3">
        <Button type="submit" size="lg" loading={busy} className="report-send w-full">
          {!busy && <Send className="report-send-icon size-4" aria-hidden />}
          <span className="language-text">{t('report.send')}</span>
        </Button>
        <p className="text-xs leading-relaxed text-muted"><span className="language-text">{t('report.context_note')}</span></p>
      </div>
    </form>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9
  return (
    <span aria-hidden className={`text-xs tabular-nums ${value > max ? 'font-semibold text-rosa-ink' : near ? 'text-giallo' : 'text-muted'}`}>
      {value}/{max}
    </span>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="report-error mt-1.5 text-sm font-medium text-rosa-ink"><span className="language-text">{message}</span></p>
}

function MyReports({ fresh }: { fresh: number | null }) {
  const { t, i18n } = useTranslation()
  const mine = useMyReports(true)
  return (
    <section aria-labelledby="my-reports" className="mt-10">
      <h2 id="my-reports" className="support-section-title"><span className="language-text">{t('report.mine_title')}</span></h2>
      <p className="mt-1 text-sm text-muted"><span className="language-text">{t('report.mine_hint')}</span></p>
      {mine.isLoading && <Spinner />}
      {mine.data && !mine.data.length && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
          <Inbox className="size-5 shrink-0" aria-hidden /><span className="language-text">{t('report.mine_empty')}</span>
        </p>
      )}
      {!!mine.data?.length && (
        <ol className="mt-4 space-y-2">
          {mine.data.map((r, i) => (
            <li key={r.id} className="report-row support-report-row support-panel" data-fresh={r.id === fresh || undefined} style={{ '--i': Math.min(i, 8) } as CSSProperties}>
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${r.kind === 'bug' ? 'bg-rosa-soft text-rosa-ink' : 'bg-giallo-soft text-ink'}`}>
                <KindIcon kind={r.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium [overflow-wrap:anywhere]">{r.title}</p>
                <p className="support-meta">
                  <span className="language-text">{t(`report.kind_${r.kind}`)}</span> · <time dateTime={r.created_at}>{reportDate(r.created_at, i18n.language)}</time>
                </p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Feeds the card spotlight its pointer position, as on the What's new page. */
function spotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const box = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--x', `${event.clientX - box.left}px`)
  event.currentTarget.style.setProperty('--y', `${event.clientY - box.top}px`)
}
