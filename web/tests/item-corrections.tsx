import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from '../src/components/shell'
import Today from '../src/pages/Today'
import Upcoming from '../src/pages/Upcoming'
import { ClassContext } from '../src/queries'
import { info as classInfo } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'
import '../src/lib/theme'

const params = new URLSearchParams(location.search)
const role = params.get('role') ?? 'student'
const id = role === 'author' ? 1 : role === 'admin' ? 4 : role === 'other' ? 3 : 2
const info = { ...classInfo, code: 'TEST', is_demo: params.get('demo') === 'true', viewer: {
  ...classInfo.viewer, member: { id, nick: role, color: '#1898C8', role: role === 'admin' ? 'admin' as const : 'member' as const },
  can_manage: role === 'admin', read_only: false,
} }
history.replaceState(null, '', '/c/TEST/in-arrivo')
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><ClassContext.Provider value={info}><AppShell info={info}>
      <Routes><Route path="/c/TEST/in-arrivo" element={<Upcoming />} /><Route path="/c/TEST" element={<Today />} /></Routes>
    </AppShell></ClassContext.Provider></BrowserRouter>
  </QueryClientProvider></StrictMode>,
)
