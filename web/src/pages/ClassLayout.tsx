import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useParams } from 'react-router'
import { api, ApiError } from '../api'
import { AppShell } from '../components/shell'
import { Button, ErrorBox, Spinner } from '../components/ui'
import { ClassContext } from '../queries'
import type { ClassInfo } from '../types'

export default function ClassLayout() {
  const { code = '' } = useParams()
  const { t } = useTranslation()
  const info = useQuery({
    queryKey: ['class', code],
    queryFn: () => api.get<ClassInfo>(`/classes/${encodeURIComponent(code)}`),
    retry: false,
  })

  if (info.isLoading) return <Spinner />
  if (info.error instanceof ApiError && info.error.status === 401) return <Navigate to={`/c/${code}/entra`} replace />
  if (info.error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBox error={info.error} />
        <Button variant="secondary" className="mt-4" onClick={() => (window.location.href = '/')}>
          {t('common.back')}
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
