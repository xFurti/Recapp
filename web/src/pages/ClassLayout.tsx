import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation, useParams } from 'react-router'
import { api, ApiError } from '../api'
import { AppShell } from '../components/shell'
import { Button, ErrorBox, Spinner } from '../components/ui'
import { ClassContext } from '../queries'
import type { ClassInfo } from '../types'
import NotFound from './NotFound'

const CLASS_PAGES = new Set(['', 'ieri', 'giorni', 'in-arrivo', 'classe'])

/** True for the class screens declared in the router, false for a missing address. */
function isKnownClassPath(pathname: string, code: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const prefix = `/c/${encodeURIComponent(code)}`
  let rest = ''
  if (path === `/c/${code}` || path === prefix) rest = ''
  else if (path.startsWith(`/c/${code}/`)) rest = path.slice(`/c/${code}/`.length)
  else if (path.startsWith(`${prefix}/`)) rest = decodeURIComponent(path.slice(prefix.length + 1))
  else return false
  if (CLASS_PAGES.has(rest)) return true
  return /^(giorno|materia|scrivi)\/[^/]+$/.test(rest)
}

export default function ClassLayout() {
  const { code = '' } = useParams()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const known = isKnownClassPath(pathname, code)
  const info = useQuery({
    queryKey: ['class', code],
    queryFn: () => api.get<ClassInfo>(`/classes/${encodeURIComponent(code)}`),
    retry: false,
  })

  if (info.isLoading) return <Spinner />
  if (!known && info.error instanceof ApiError && (info.error.status === 401 || info.error.status === 404)) {
    return <NotFound />
  }
  if (info.error instanceof ApiError && info.error.status === 401) return <Navigate to={`/c/${code}/entra`} replace />
  if (info.error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBox error={info.error} />
        <Button variant="secondary" className="mt-4" onClick={() => (window.location.href = '/')}>
          <span className="language-text">{t('common.back')}</span>
        </Button>
      </div>
    )
  }
  if (!info.data) return null
  if (info.data.code !== code) return <Navigate to={`/c/${info.data.code}`} replace />
  return (
    <ClassContext.Provider value={info.data}>
      <AppShell info={info.data}>
        <Outlet />
      </AppShell>
    </ClassContext.Provider>
  )
}
