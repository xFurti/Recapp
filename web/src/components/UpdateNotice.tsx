import { ArrowRight, X } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'
import { flushPendingWork } from '../lib/pendingWork'
import { dismissUpdate, useUpdateNotice } from '../lib/updates'
import { RecappMark } from './RecappMark'
import { Button } from './ui'

/** Follow the current page header, including lazy routes and the class simulation bar. */
function useNoticeTop(visible: boolean, headerRef?: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const [top, setTop] = useState<number>()
  useLayoutEffect(() => {
    if (!visible) return
    let header: HTMLElement | null = null
    let frame = 0
    const position = () => {
      frame = 0
      setTop(Math.max(12, (header?.getBoundingClientRect().bottom ?? 0) + 12))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(position) }
    const resize = new ResizeObserver(schedule)
    const attach = () => {
      const next = headerRef?.current ?? Array.from(document.querySelectorAll<HTMLElement>('#root header')).find(element => element.getClientRects().length > 0) ?? null
      if (next !== header) {
        resize.disconnect()
        header = next
        if (header) resize.observe(header)
      }
      position()
    }
    const mutation = new MutationObserver(attach)
    const root = document.getElementById('root')
    if (root) mutation.observe(root, { childList: true, subtree: true })
    attach()
    addEventListener('resize', schedule)
    addEventListener('scroll', schedule, { passive: true })
    return () => {
      mutation.disconnect()
      resize.disconnect()
      cancelAnimationFrame(frame)
      removeEventListener('resize', schedule)
      removeEventListener('scroll', schedule)
    }
  }, [visible, pathname, headerRef])
  return top
}

/** A polite, persistent notice: no automatic reload, focus change or layout shift. */
export function UpdateNotice({ headerRef }: { headerRef?: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation()
  const notice = useUpdateNotice()
  const top = useNoticeTop(!!notice, headerRef)
  const id = useId()
  const saving = useRef(false)
  const [attempt, setAttempt] = useState<{ key: string; status: 'saving' | 'failed' }>()
  const reloading = attempt?.key === notice?.key ? attempt?.status : undefined
  const preparing = notice?.kind === 'preparing'
  const title = t(preparing ? 'update.preparing' : 'update.ready')
  const subtitle = t(preparing ? 'update.preparing_description' : 'update.ready_description')
  const message = reloading === 'failed' ? t('update.save_failed') : reloading === 'saving' ? t('update.saving') : ''

  const updateNow = async () => {
    if (!notice || preparing || saving.current) return
    const key = notice.key
    saving.current = true
    setAttempt({ key, status: 'saving' })
    try {
      await flushPendingWork()
      window.location.reload()
    } catch {
      setAttempt({ key, status: 'failed' })
    } finally {
      saving.current = false
    }
  }

  return createPortal(
    <div className="update-notice-host" style={{ '--update-notice-top': top === undefined ? undefined : `${top}px` } as CSSProperties}>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {notice && `${title}. ${subtitle}${message ? ` ${message}` : ''}`}
      </div>
      {notice && <section className="update-notice" data-state={notice.kind} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <div className="update-notice-heading">
          <div className="update-notice-icon" aria-hidden>
            <RecappMark playing={preparing} className="update-notice-logo" />
            <span className="update-notice-dot" />
          </div>
          <div key={notice.kind} className="update-notice-copy">
            <h2 id={`${id}-title`} className="language-text font-bold">{title}</h2>
            <p id={`${id}-description`} className="language-text mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>
          </div>
          <button type="button" className="update-notice-dismiss" onClick={() => dismissUpdate(notice.key)} disabled={reloading === 'saving'} aria-label={t('update.dismiss')}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="update-notice-details" inert={preparing} aria-hidden={preparing}>
          <div className="update-notice-details-inner">
            {message && <p className={`update-notice-message language-text text-xs leading-relaxed ${reloading === 'failed' ? 'text-rosa-ink' : 'text-muted'}`}>{message}</p>}
            <div className="update-notice-actions">
              <Button size="sm" variant="ghost" onClick={() => dismissUpdate(notice.key)} disabled={reloading === 'saving'}><span className="language-text">{t('update.later')}</span></Button>
              <Button size="sm" onClick={updateNow} loading={reloading === 'saving'}>
                <span className="language-text">{reloading === 'saving' ? t('update.saving_short') : reloading === 'failed' ? t('common.retry') : t('update.now')}</span>
                {reloading !== 'saving' && <ArrowRight className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
      </section>}
    </div>, document.body,
  )
}

/** Public pages use their own header as the floating notice's anchor. */
export function WithUpdateNotice() {
  return <><Outlet /><UpdateNotice /></>
}
