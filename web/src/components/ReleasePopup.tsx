import { useIsFetching, useIsMutating, useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { api } from '../api'
import { hasPendingWork } from '../lib/pendingWork'
import { appVersion, localized, locallySeen, rememberRelease, useReleases, type Release, type ReleaseAccount } from '../lib/releases'
import { Button } from './ui'

/** One mounted instance per account. The first visit establishes a baseline before
 * the tutorial finishes, so closing the tutorial never triggers an announcement. */
export function ReleasePopup({ account, firstVisit, suspended = false }: {
  account: ReleaseAccount; firstVisit: boolean; suspended?: boolean
}) {
  const notes = useReleases()
  const preference = useQuery({ queryKey: ['release-preference', account.key],
    queryFn: () => api.get<{ seen: string[] }>('/release-preference'), enabled: !account.local,
    retry: false, staleTime: 0, refetchInterval: 60_000 })
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const { pathname } = useLocation()
  const baseline = useRef(firstVisit)
  const accountKey = account.key
  const localAccount = account.local
  const [open, setOpen] = useState<Release | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  const release = notes.data?.releases.find((note) => note.id === notes.data?.current)
  const matchesBuild = notes.data && (appVersion === 'dev' || notes.data.version === appVersion)

  useEffect(() => {
    const identity = { key: accountKey, local: localAccount }
    if (!release || !matchesBuild || (!localAccount && !preference.isSuccess)) return
    const seen = [...locallySeen(identity), ...(preference.data?.seen ?? []), ...dismissed]
    if (baseline.current && seen.length === 0) {
      rememberRelease(identity, release.id).catch(() => undefined)
      baseline.current = false
      return
    }
    if (seen.includes(release.id)) {
      // Retry a previous failed account save, using the local copy only as fallback.
      if (!localAccount && !(preference.data?.seen ?? []).includes(release.id)) {
        rememberRelease(identity, release.id).catch(() => undefined)
      }
      return
    }
    let safeSince = 0
    const check = () => {
      const focused = document.activeElement
      const blocked = suspended || pathname.includes('/scrivi/') || fetching > 0 || mutating > 0 || hasPendingWork()
        || document.visibilityState !== 'visible'
        || !!document.querySelector('dialog[open], [role="dialog"], [role="menu"], [aria-busy="true"], .page-curtain:not([hidden]), button:disabled .animate-spin')
        || (focused instanceof HTMLElement && !!focused.closest('input, textarea, select, [contenteditable="true"]'))
      if (blocked) { safeSince = 0; return }
      if (!safeSince) safeSince = Date.now()
      if (Date.now() - safeSince >= 800) { setOpen(release); window.clearInterval(timer) }
    }
    const timer = window.setInterval(check, 200)
    return () => window.clearInterval(timer)
  }, [accountKey, localAccount, release, matchesBuild, preference.isSuccess, preference.data, suspended, fetching, mutating, pathname, dismissed])

  const visible = open && matchesBuild && open.id === notes.data?.current ? open : null
  const dismiss = () => {
    if (!visible) return
    rememberRelease(account, visible.id).catch(() => undefined)
    setDismissed((old) => [...old, visible.id])
    setOpen(null)
  }
  return visible ? <ReleaseDialog release={visible} onClose={dismiss} /> : null
}

function ReleaseDialog({ release, onClose }: { release: Release; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const focus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (focus?.isConnected) focus.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(
    <dialog ref={dialog} tabIndex={-1} aria-labelledby="release-popup-title" aria-describedby="release-popup-subtitle"
      className="release-dialog m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-line bg-surface p-6 text-ink shadow-2xl"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'))
        const first = controls[0]
        const last = controls.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
          event.preventDefault(); first?.focus()
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      } }}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-bordeaux-soft text-bordeaux"><Sparkles aria-hidden className="size-6" /></span>
        <button onClick={onClose} className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-ink/5" aria-label={t('common.close')}><X className="size-5" /></button>
      </div>
      <h2 id="release-popup-title" className="mt-4 text-2xl font-extrabold tracking-tight"><span className="language-text">{t('news.popup_title')}</span></h2>
      <p id="release-popup-subtitle" className="mt-2 font-semibold"><span className="language-text">{localized(release.title, i18n.language)}</span></p>
      <ul className="my-5 list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted">
        {release.summary.slice(0, 5).map((point, index) => <li key={index}><span className="language-text">{localized(point, i18n.language)}</span></li>)}
      </ul>
      <div className="flex flex-col gap-3">
        <Button onClick={onClose}><span className="language-text">{t('news.got_it')}</span></Button>
        <Link to={`/novita#release-${release.id}`} onClick={onClose} className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-bordeaux hover:underline">
          <span className="language-text">{t('news.read_all')}</span><ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </dialog>, document.body,
  )
}
