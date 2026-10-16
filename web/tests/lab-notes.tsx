import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { api } from '../src/api'
import { DayCardView } from '../src/components/day'
import { AppShell } from '../src/components/shell'
import Editor from '../src/pages/Editor'
import Upcoming from '../src/pages/Upcoming'
import { ClassContext } from '../src/queries'
import type { CardPage } from '../src/types'
import { info as fixtureInfo } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'

const info = { ...fixtureInfo, subjects: [...fixtureInfo.subjects, { code: 'TCI', name_it: 'Telecomunicazioni', name_en: 'Telecommunications', color: '#b89420' }] }
history.replaceState(null, '', '/c/TEST/scrivi/2026-10-02')
// Standalone browser-test entry point, outside the production bundle.
// oxlint-disable-next-line react/only-export-components
function Published() {
  const { data } = useQuery({ queryKey: ['published'], queryFn: () => api.get<CardPage>('/classes/TEST/cards/2026-10-02') })
  return data?.card && <DayCardView card={data.card} subjects={info.subjects} classLabel={info.label} classInfo={info} canShare />
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter>
        <ClassContext.Provider value={info}>
          <AppShell info={info}>
            <Routes>
              <Route path="/c/TEST/scrivi/:day" element={<Editor />} />
              <Route path="/c/TEST/giorno/:day" element={<Published />} />
              <Route path="/c/TEST/in-arrivo" element={<Upcoming />} />
            </Routes>
          </AppShell>
        </ClassContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
