import { useQuery } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { api } from './api'
import type { ClassInfo, Me, TodayInfo } from './types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/me'), staleTime: 60_000 })
}

export const ClassContext = createContext<ClassInfo | null>(null)

export function useClass(): ClassInfo {
  const ctx = useContext(ClassContext)
  if (!ctx) throw new Error('useClass outside ClassLayout')
  return ctx
}

export const classPath = (code: string, path = '') => `/classes/${encodeURIComponent(code)}${path}`

export function useToday(code: string) {
  return useQuery({
    queryKey: ['today', code],
    queryFn: () => api.get<TodayInfo>(classPath(code, '/today')),
    refetchInterval: 60_000,
  })
}
