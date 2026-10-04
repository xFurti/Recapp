import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Feedback } from '../src/components/Feedback'
import '../src/i18n'
import '../src/index.css'

const params = new URLSearchParams(location.search)
if (params.has('dark')) document.documentElement.classList.add('dark')
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <main className="mx-auto max-w-2xl p-4 sm:py-16">
        <Feedback code="TEST" day="2026-10-01" readOnly={params.has('readonly')} />
      </main>
    </QueryClientProvider>
  </StrictMode>,
)
