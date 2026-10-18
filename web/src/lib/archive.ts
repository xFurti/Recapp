import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType, useSearchParams } from 'react-router'
import { api } from '../api'
import { classPath, useClass } from '../queries'
import { addDays, getSimulatedNow, isoDay, parseDay, todayIso } from './clock'

export type ArchivePeriod = 'week' | '2weeks' | 'all' | 'month' | 'custom'
export type ArchivePage<T> = { results: T[]; next_cursor: string | null }
export type ArchiveReturnState = { from?: string; archiveFrom?: string; archiveY?: number }

const dateValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isoDay(parseDay(value)) === value

export function archivePeriod(search: URLSearchParams, fallback: ArchivePeriod) {
  const raw = search.get('period') ?? fallback
  const mode: ArchivePeriod = ['week', '2weeks', 'all', 'month', 'custom'].includes(raw) ? raw as ArchivePeriod : fallback
  const month = search.get('month') ?? todayIso().slice(0, 7)
  let from = search.get('from') ?? ''
  let to = search.get('to') ?? ''
  let valid = true
  if (mode === 'month') {
    valid = dateValue(`${month}-01`)
    from = `${month}-01`
    const end = parseDay(from)
    end.setMonth(end.getMonth() + 1, 0)
    to = valid ? isoDay(end) : ''
  } else if (mode !== 'custom') {
    from = mode === 'week' || mode === '2weeks' ? addDays(todayIso(), mode === 'week' ? -7 : -14) : ''
    to = ''
  }
  valid = valid && (!from || dateValue(from)) && (!to || dateValue(to)) && (!from || !to || from <= to)
  const query = new URLSearchParams({ paged: 'true', limit: '30', range: mode === 'week' || mode === '2weeks' ? mode : 'all' })
  if (from) query.set('from_date', from)
  if (to) query.set('to_date', to)
  return { mode, month, from, to, valid, query: query.toString() }
}

/** A subject inherits the period, but starts at its own first page. */
export function archiveSubjectSearch(path: string) {
  const url = new URL(path, window.location.origin)
  if (!/\/(giorni|materia\/[^/]+)$/.test(url.pathname)) return ''
  const search = new URLSearchParams(url.search)
  search.delete('pages')
  if (!search.has('period')) search.set('period', url.pathname.endsWith('/giorni') ? 'all' : '2weeks')
  return `?${search}`
}

export function useArchive<T>(scope: 'cards' | 'subject', endpoint: string, fallback: ArchivePeriod) {
  const info = useClass()
  const location = useLocation()
  const [search, setSearch] = useSearchParams()
  const period = archivePeriod(search, fallback)
  const requested = Number(search.get('pages') ?? 1)
  const pages = Number.isSafeInteger(requested) && requested > 0 ? requested : 1
  const query = useInfiniteQuery({
    queryKey: [scope, info.code, endpoint, period.query, getSimulatedNow(), todayIso()],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.get<ArchivePage<T>>(classPath(info.code, `${endpoint}?${period.query}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`)),
    getNextPageParam: (last) => last.next_cursor,
    enabled: period.valid,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  })
  const loaded = query.data?.pages.length ?? 0
  const restoring = loaded > 0 && loaded < pages && query.hasNextPage && !query.isFetchNextPageError
  const { isFetching, fetchNextPage } = query
  useEffect(() => {
    if (restoring && !isFetching) void fetchNextPage({ cancelRefetch: false })
  }, [restoring, isFetching, fetchNextPage])

  async function loadMore() {
    if (query.isFetching) return
    if (query.isError && !query.isFetchNextPageError) { await query.refetch(); return }
    const next = loaded > pages ? query : await query.fetchNextPage({ cancelRefetch: false })
    if (next.isError || !next.data) return
    const count = Math.min(pages + 1, next.data.pages.length)
    if (count <= pages) return
    const nextSearch = new URLSearchParams(search)
    nextSearch.set('pages', String(count))
    setSearch(nextSearch, { replace: true, state: { ...location.state, archiveY: window.scrollY } })
  }

  const results = query.data?.pages.slice(0, pages).flatMap(page => page.results) ?? []
  const hasMore = loaded > pages || !!query.hasNextPage
  useArchivePosition(period.valid && !!query.data && (loaded >= pages || !query.hasNextPage))
  return { ...query, results, hasMore, loadMore, restoring, period }
}

/** Restore only once the saved pages exist, including after a reload with an empty cache. */
function useArchivePosition(ready: boolean) {
  const location = useLocation()
  const navigation = useNavigationType()
  const path = location.pathname + location.search
  const selectedY = (location.state as ArchiveReturnState | null)?.archiveY
  const fallback = selectedY ?? 0
  const commanded = navigation !== 'POP' && selectedY !== undefined
  useLayoutEffect(() => {
    const previous = history.scrollRestoration
    const previousAnchor = document.documentElement.style.overflowAnchor
    history.scrollRestoration = 'manual'
    document.documentElement.style.overflowAnchor = 'none'
    return () => {
      history.scrollRestoration = previous
      document.documentElement.style.overflowAnchor = previousAnchor
    }
  }, [])
  useLayoutEffect(() => {
    if (!ready) return
    const key = `recapp.archive.position:${path}`
    let y = fallback
    try {
      const saved = sessionStorage.getItem(key)
      if (!commanded && saved !== null && Number.isFinite(Number(saved))) y = Math.max(0, Number(saved))
    } catch { /* storage may be unavailable */ }
    let restored = false
    let cancelled = false
    const save = () => {
      if (!restored) return
      try { sessionStorage.setItem(key, String(window.scrollY)) } catch { /* private mode */ }
    }
    let frame = 0
    void document.fonts.ready.then(() => {
      if (cancelled) return
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: 'instant' })
          restored = true
        })
      })
    })
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('pagehide', save)
    document.addEventListener('click', save, true)
    return () => {
      cancelAnimationFrame(frame)
      cancelled = true
      window.removeEventListener('scroll', save)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('click', save, true)
    }
  }, [path, ready, fallback, commanded])
}
