import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { api } from '../src/api'
import { DayCardView } from '../src/components/day'
import { AppShell } from '../src/components/shell'
import Editor from '../src/pages/Editor'
import { ClassContext } from '../src/queries'
import type { CardPage } from '../src/types'
import { info } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'

history.replaceState(null, '', '/c/TEST/scrivi/2026-10-02')
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
            <Routes>
              <Route path="/c/TEST/scrivi/:day" element={<Editor />} />
              <Route path="/c/TEST/giorno/:day" element={<Published />} />
            </Routes>
          </AppShell>
        </ClassContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
