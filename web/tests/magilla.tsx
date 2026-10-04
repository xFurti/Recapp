import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MagillaGame from '../src/components/magilla/MagillaGame'
import '../src/i18n'
import '../src/index.css'

const params = new URLSearchParams(location.search)
if (params.has('dark')) document.documentElement.classList.add('dark')
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="mx-auto max-w-3xl p-4 sm:py-16">
      <MagillaGame />
      <button type="button" className="mt-4">Outside</button>
    </main>
  </StrictMode>,
)
