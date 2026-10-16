import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { DayCardView } from '../src/components/day'
import { AppShell } from '../src/components/shell'
import SubjectPage from '../src/pages/SubjectPage'
import Today from '../src/pages/Today'
import Upcoming from '../src/pages/Upcoming'
import { ClassContext } from '../src/queries'
import { card, info } from './calendar-fixture'
import '../src/i18n'
import '../src/lib/theme'
import '../src/index.css'

const params = new URLSearchParams(location.search)
const classroom = { ...info, code: params.has('demo') ? 'DEMO' : info.code, is_demo: params.has('demo') }
history.replaceState(null, '', `/c/${classroom.code}${params.get('path') ?? '/in-arrivo'}`)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter>
        <ClassContext.Provider value={classroom}>
          <AppShell info={classroom}>
            <Routes>
              <Route path="/c/:code" element={<Today />} />
              <Route path="/c/:code/in-arrivo" element={<Upcoming />} />
              <Route path="/c/:code/materia/STO" element={<SubjectPage />} />
              <Route path="/c/:code/giorno/:day" element={<DayCardView card={card} subjects={info.subjects} classLabel={info.label} />} />
            </Routes>
          </AppShell>
        </ClassContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
