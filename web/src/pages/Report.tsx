import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { ReportBody } from '../components/Report'
import { originPage } from '../lib/report'
import { LangToggle, Logo, ThemeToggle, Wordmark } from '../components/shell'
import { useClass } from '../queries'

/** /segnala: from the home page and the FAQ, also without signing in. */
export default function ReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [from] = useState(() => originPage(location.state, '/segnala'))
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <Link to="/" aria-label={t('common.app_name')}><Wordmark /></Link><Logo className="h-7 sm:h-8" />
          </span>
          <div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /><LangToggle /></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-5">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="mb-5 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /><span className="language-text">{t('report.back')}</span>
        </button>
        <ReportBody from={from} />
      </main>
    </div>
  )
}

/** /c/:code/segnala: inside the class, from the profile menu. */
export function ClassReportPage() {
  const info = useClass()
  const location = useLocation()
  const [from] = useState(() => originPage(location.state, `/c/${info.code}/segnala`))
  return <ReportBody from={from} />
}
