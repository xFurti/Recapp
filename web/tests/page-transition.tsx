import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Outlet, RouterProvider, useSearchParams } from 'react-router'
import { api } from '../src/api'
import { AppShell } from '../src/components/shell'
import { ErrorBox, Spinner } from '../src/components/ui'
import { usePendingWork } from '../src/lib/pendingWork'
import type { ClassInfo } from '../src/types'
import '../src/i18n'
import '../src/lib/theme'
import '../src/index.css'

const params = new URLSearchParams(location.search)
history.replaceState(null, '', params.get('route') ?? '/c/TEST')
const info: ClassInfo = {
  code: 'TEST', name: 'Transition test', label: 'Classe di prova', is_demo: false, subjects: [], hours: [],
  viewer: { kind: 'member', member: { id: 1, nick: 'Leo', color: '#a02848', role: 'admin' }, can_manage: true, read_only: false, tour_seen: true },
}

const lines = (label: string) => Array.from({ length: 40 }, (_, i) => <p key={i} className="py-2">{label} · riga {i + 1}</p>)

function Today() {
  return <><h1>Oggi</h1><input aria-label="Nota" defaultValue="" /><Link to="/c/TEST/scrivi/2026-10-03">Scrivi</Link>{lines('Oggi')}</>
}
function Yesterday() {
  const [search] = useSearchParams()
  return <><h1>Ieri</h1><p data-filter>{search.get('materia') ?? 'tutte'}</p><Link to="?materia=MAT">Filtra matematica</Link>{lines('Ieri')}</>
}
/** Loads from the network: the spec decides how slowly. */
function Upcoming() {
  const q = useQuery({ queryKey: ['upcoming'], queryFn: () => api.get<{ title: string }>('/upcoming') })
  return <><h1>In arrivo</h1>{q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : <p data-loaded>{q.data?.title}</p>}</>
}
function ClassPage() {
  const q = useQuery({ queryKey: ['members'], queryFn: () => api.get('/members') })
  return <><h1>Classe</h1>{q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : <p data-loaded>ok</p>}</>
}
/** An editor whose changes cannot be saved: leaving through the tour must be refused. */
function Editor() {
  usePendingWork({ dirty: () => true, flush: () => Promise.reject(new Error('offline')) })
  return <><h1>Scrivi</h1><textarea aria-label="Testo" defaultValue="" /></>
}

function Shell() {
  return <AppShell info={info}><Outlet /></AppShell>
}

const router = createBrowserRouter([{
  path: '/c/TEST',
  element: <Shell />,
  children: [
    { index: true, element: <Today /> },
    { path: 'ieri', element: <Yesterday /> },
    { path: 'in-arrivo', element: <Upcoming /> },
    { path: 'classe', element: <ClassPage /> },
    { path: 'scrivi/:day', element: <Editor /> },
  ],
}])
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)
