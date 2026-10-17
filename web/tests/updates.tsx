import '@fontsource-variable/inter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { api } from '../src/api'
import { AppShell } from '../src/components/shell'
import { WithUpdateNotice } from '../src/components/UpdateNotice'
import { usePendingWork } from '../src/lib/pendingWork'
import Landing from '../src/pages/Landing'
import { info } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'
import '../src/lib/theme'

const options = new URLSearchParams(location.search)
const About = lazy(() => import('../src/pages/About'))
const publicPage = options.has('public')
history.replaceState(null, '', publicPage ? '/' : '/c/TEST')

export function Work() {
  const [draft, setDraft] = useState('')
  const dirty = useRef(false)
  usePendingWork({ dirty: () => dirty.current, flush: async () => {
    await api.put('/test-draft', { draft })
    dirty.current = false
  } })
  return <main style={{ minHeight: 1600 }}>
    <h1 className="text-2xl font-bold">La tua giornata</h1>
    <label className="mt-64 block">Draft<textarea className="block w-full rounded-xl border border-line bg-surface p-4" value={draft} onChange={event => { dirty.current = true; setDraft(event.target.value) }} /></label>
    <p className="mt-4">Le modifiche vengono salvate prima di ricaricare la pagina.</p>
  </main>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><Routes>
      <Route element={<WithUpdateNotice />}>
        <Route path="/" element={<Landing />} />
        <Route path="/faq" element={<Suspense fallback={<p>Loading…</p>}><About /></Suspense>} />
      </Route>
      <Route path="*" element={<AppShell info={info}><Work /></AppShell>} />
    </Routes></BrowserRouter>
  </QueryClientProvider></StrictMode>,
)
