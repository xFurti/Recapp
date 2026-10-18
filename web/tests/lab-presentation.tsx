import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { api } from '../src/api'
import { DayCardView } from '../src/components/day'
import { AppShell } from '../src/components/shell'
import Editor from '../src/pages/Editor'
import SubjectPage from '../src/pages/SubjectPage'
import { ClassContext } from '../src/queries'
import type { CardPage } from '../src/types'
import { info } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'

const view = new URLSearchParams(location.search).get('view') ?? 'day'
history.replaceState(null, '', view === 'subject' ? '/c/TEST/materia/INI' : view === 'editor' ? '/c/TEST/scrivi/2026-10-02' : '/c/TEST/giorno/2026-10-02')
// oxlint-disable-next-line react/only-export-components
function Published() {
  const { data } = useQuery({ queryKey: ['published'], queryFn: () => api.get<CardPage>('/classes/TEST/cards/2026-10-02') })
  return data?.card && <DayCardView card={data.card} subjects={info.subjects} classLabel={info.label} />
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter>
        <ClassContext.Provider value={info}>
          <AppShell info={info}>
            <nav className="mb-4 flex flex-wrap gap-4" aria-label="Fixture views">
              <Link to="/c/TEST/giorno/2026-10-02">Giornata</Link>
              <Link to="/c/TEST/materia/INI">Materia</Link>
              <Link to="/c/TEST/scrivi/2026-10-02">Editor</Link>
            </nav>
            <Routes>
              <Route path="/c/TEST/giorno/:day" element={<Published />} />
              <Route path="/c/TEST/materia/:subject" element={<SubjectPage />} />
              <Route path="/c/TEST/scrivi/:day" element={<Editor />} />
            </Routes>
          </AppShell>
        </ClassContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
