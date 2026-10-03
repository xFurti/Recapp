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
import { WithUpdateNotice } from './components/UpdateNotice'
import ClassLayout from './pages/ClassLayout'
import { DayByDate, DaysList, Yesterday } from './pages/DayPage'
import Join from './pages/Join'
import Landing from './pages/Landing'
import SubjectPage from './pages/SubjectPage'
import Today from './pages/Today'
import Upcoming from './pages/Upcoming'

const ClassPage = lazy(() => import('./pages/ClassPage'))
const Editor = lazy(() => import('./pages/Editor'))
const About = lazy(() => import('./pages/About'))
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
  {
    element: <WithUpdateNotice />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/faq', element: later(<About />) },
      { path: '/privacy', element: later(<Privacy />) },
      { path: '/scuola', element: later(<SchoolArea />) },
      { path: '/c/:code/entra', element: <Join /> },
      { path: '*', element: <Landing /> },
    ],
  },
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
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
