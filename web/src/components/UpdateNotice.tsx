import { Info, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { flushPendingWork } from '../lib/pendingWork'
import { dismissUpdate, useUpdateNotice } from '../lib/updates'
import { Button } from './ui'

/** Never reloads on its own and never takes focus: the live region only announces politely. */
export function UpdateNotice() {
  const { t } = useTranslation()
  const notice = useUpdateNotice()
  const [reloading, setReloading] = useState<'idle' | 'saving' | 'failed'>('idle')

  const updateNow = async () => {
    setReloading('saving')
    try {
      await flushPendingWork()
      window.location.reload()
    } catch {
      setReloading('failed')
    }
  }

  return (
    <div role="status" aria-live="polite">
      {notice?.kind === 'preparing' && (
        <div className="bg-azzurro-soft text-azzurro-ink">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-1.5 text-xs font-semibold sm:text-sm">
            <Info className="size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1"><span className="language-text">{t('update.preparing')}</span></p>
            <button onClick={() => dismissUpdate(notice.key)} className="-mr-1.5 shrink-0 rounded-full p-1.5 hover:bg-azzurro-ink/10" aria-label={t('update.dismiss')}>
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      {notice?.kind === 'ready' && (
        <div className="bg-bordeaux-soft text-ink">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm">
            <RefreshCw className="size-4 shrink-0 text-bordeaux" aria-hidden />
            <p className="min-w-0 flex-1 font-semibold">
              <span className="language-text">{t('update.ready')}</span>
              {reloading === 'failed' && <span className="mt-0.5 block text-xs font-medium text-rosa-ink"><span className="language-text">{t('update.save_failed')}</span></span>}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={updateNow} loading={reloading === 'saving'}>
                <span className="language-text">{reloading === 'failed' ? t('common.retry') : t('update.now')}</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismissUpdate(notice.key)} disabled={reloading === 'saving'}>
                <span className="language-text">{t('update.later')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Pages without the class shell show the notice at the top of the page. */
export function WithUpdateNotice() {
  return (
    <>
      <UpdateNotice />
      <Outlet />
    </>
  )
}
