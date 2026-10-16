import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AppShell } from '../src/components/shell'
import { Modal } from '../src/components/ui'
import { usePendingWork } from '../src/lib/pendingWork'
import News from '../src/pages/News'
import { info } from './lesson-fixture'
import '../src/i18n'
import '../src/index.css'
import '../src/lib/theme'

const options = new URLSearchParams(location.search)
const classInfo = { ...info, is_demo: options.has('demo'), viewer: { ...info.viewer, tour_seen: !options.has('fresh') } }
history.replaceState(null, '', options.has('editor') ? '/c/TEST/scrivi/2026-10-13' : '/c/TEST')
export function Work() {
  const [dirty, setDirty] = useState(false)
  const [modal, setModal] = useState(false)
  const mutation = useMutation({ mutationFn: () => new Promise((resolve) => setTimeout(resolve, 2200)) })
  usePendingWork({ dirty: () => dirty, flush: async () => { setDirty(false) } })
  return <div>
    <h1>La tua giornata</h1>
    <textarea aria-label="Draft" />
    <button onClick={() => setDirty(!dirty)}>Toggle unsaved work</button>
    <button onClick={() => setModal(true)}>Open another dialog</button>
    <button onClick={() => mutation.mutate()}>Save something</button>
    <Link to="/c/TEST/scrivi/2026-10-13">Editor</Link>
    <Link to="/c/TEST">Today</Link>
    <Modal open={modal} onClose={() => setModal(false)} title="Another dialog">Other operation</Modal>
  </div>
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><Routes>
      <Route path="/novita" element={<News />} />
      <Route path="*" element={<AppShell info={classInfo}><Work /></AppShell>} />
    </Routes></BrowserRouter>
  </QueryClientProvider></StrictMode>,
)
