import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { ReportBody } from '../components/Report'
import { originPage } from '../lib/report'
import { PageReturn, SupportHeader } from '../components/SupportPage'
import { useClass } from '../queries'

/** /segnala: from the home page and the FAQ, also without signing in. */
export default function ReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [from] = useState(() => originPage(location.state, '/segnala'))
  return (
    <div className="support-page min-h-dvh">
      <SupportHeader />
      <main className="support-width support-main">
        <PageReturn onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>{t('report.back')}</PageReturn>
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
