import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, useLocation } from 'react-router'
import { AppShell } from '../src/components/shell'
import type { ClassInfo } from '../src/types'
import '../src/i18n'
import '../src/lib/theme'
import '../src/index.css'

const params = new URLSearchParams(location.search)
history.replaceState(null, '', params.get('route') ?? '/c/TEST')
const info: ClassInfo = {
  code: 'TEST', name: 'Navigation test', label: 'Classe di prova', is_demo: false, subjects: [], hours: [],
  viewer: { kind: 'member', member: { id: 1, nick: 'Leo', color: '#a02848', role: 'admin' }, can_manage: true, read_only: false, tour_seen: true },
}
function Preview() {
  const { pathname } = useLocation()
  return <AppShell info={info}>
    <h1>{pathname}</h1>
    <Link to="/c/TEST/scrivi/2026-10-03">Editor</Link>{' '}
    <Link to="/c/TEST/materia/MAT">Materia</Link>{' '}
    <Link to="/c/TEST/giorni">Archivio</Link>
  </AppShell>
}
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter><Preview /></BrowserRouter></QueryClientProvider></StrictMode>)
