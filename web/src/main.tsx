import '@fontsource-variable/inter'
import './index.css'
import './i18n'
import './lib/theme'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ApiError } from './api'
import { Spinner } from './components/ui'
import ClassLayout from './pages/ClassLayout'
import { DayByDate, DaysList, Yesterday } from './pages/DayPage'
import Join from './pages/Join'
import Landing from './pages/Landing'
import SubjectPage from './pages/SubjectPage'
import Today from './pages/Today'
import Upcoming from './pages/Upcoming'

const ClassPage = lazy(() => import('./pages/ClassPage'))
const Editor = lazy(() => import('./pages/Editor'))
const Privacy = lazy(() => import('./pages/Privacy'))
const SchoolArea = lazy(() => import('./pages/SchoolArea'))

const later = (node: ReactNode) => <Suspense fallback={<Spinner />}>{node}</Suspense>

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
})

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/privacy', element: later(<Privacy />) },
  { path: '/scuola', element: later(<SchoolArea />) },
  { path: '/c/:code/entra', element: <Join /> },
  {
    path: '/c/:code',
    element: <ClassLayout />,
    children: [
      { index: true, element: <Today /> },
      { path: 'ieri', element: <Yesterday /> },
      { path: 'giorno/:day', element: <DayByDate /> },
      { path: 'giorni', element: <DaysList /> },
      { path: 'materia/:subject', element: <SubjectPage /> },
      { path: 'in-arrivo', element: <Upcoming /> },
      { path: 'classe', element: later(<ClassPage />) },
      { path: 'scrivi/:day', element: later(<Editor />) },
    ],
  },
  { path: '*', element: <Landing /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
