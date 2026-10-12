import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AppShell } from '../src/components/shell'
import Editor from '../src/pages/Editor'
import Today from '../src/pages/Today'
import Upcoming from '../src/pages/Upcoming'
import { ClassContext } from '../src/queries'
import { info } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'

const view = new URLSearchParams(location.search).get('view')
const path = view === 'editor' ? '/scrivi/2026-10-02' : view === 'today' ? '' : '/in-arrivo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/c/TEST${path}`]}>
        <ClassContext.Provider value={info}>
          <AppShell info={info}>
            <Routes>
              <Route path="/c/TEST" element={<Today />} />
              <Route path="/c/TEST/in-arrivo" element={<Upcoming />} />
              <Route path="/c/TEST/scrivi/:day" element={<Editor />} />
            </Routes>
          </AppShell>
        </ClassContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  </StrictMode>,
)
