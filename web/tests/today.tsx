import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AppShell } from '../src/components/shell'
import Today from '../src/pages/Today'
import { ClassContext } from '../src/queries'
import { todayClass } from './today-fixture'
import '../src/i18n'
import '../src/index.css'

const info = todayClass(new URLSearchParams(location.search).get('who') ?? 'member')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/c/TEST']}>
        <ClassContext.Provider value={info}>
          <AppShell info={info}>
            <Routes>
              <Route path="/c/TEST" element={<Today />} />
              <Route path="/c/TEST/in-arrivo" element={<h1>In arrivo</h1>} />
              <Route path="/c/TEST/scrivi/:day" element={<h1>Editor</h1>} />
            </Routes>
          </AppShell>
        </ClassContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  </StrictMode>,
)
