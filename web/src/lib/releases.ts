import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

declare const __APP_VERSION__: string
export const appVersion = __APP_VERSION__
export type Localized = { it: string; en: string }
export type Release = {
  id: string
  published_at: string
  title: Localized
  summary: Localized[]
  entries: {
    category: 'feature' | 'improvement' | 'fix'
    title: Localized
    body: Localized
    link?: { href: string; label: Localized; requires_login: boolean }
    image?: { src: string; alt: Localized }
  }[]
}
export type Releases = { version: string; current: string | null; releases: Release[] }
export type ReleaseAccount = { key: string; local: boolean }
const memory = new Map<string, string[]>()
const synced = new Map<string, Set<string>>()
const saving = new Map<string, Promise<unknown>>()

export function useReleases() {
  return useQuery({ queryKey: ['releases'], queryFn: async () => {
    const result = await api.get<Releases>('/releases')
    if (!result || typeof result.version !== 'string' || !Array.isArray(result.releases)
      || (result.current !== null && typeof result.current !== 'string')) throw new Error('Invalid release notes')
    return result
  },
    retry: false, staleTime: 30_000, refetchInterval: 60_000 })
}
export function localized(value: Localized, lang: string) {
  return value[lang.startsWith('it') ? 'it' : 'en']
}
export function locallySeen(account: ReleaseAccount): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(account.key) ?? '[]')
    return [...new Set([...(memory.get(account.key) ?? []), ...(Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string') : [])])]
  } catch {
    return memory.get(account.key) ?? []
  }
}
export function rememberRelease(account: ReleaseAccount, id: string) {
  const seen = [...new Set([...locallySeen(account), id])]
  memory.set(account.key, seen)
  try { localStorage.setItem(account.key, JSON.stringify(seen)) } catch { /* This tab still remembers. */ }
  if (account.local || synced.get(account.key)?.has(id)) return Promise.resolve()
  const saveKey = `${account.key}:${id}`
  const pending = saving.get(saveKey)
  if (pending) return pending
  const promise = api.post('/release-preference', { release_id: id }).then(() => {
    synced.set(account.key, new Set([...(synced.get(account.key) ?? []), id]))
  }).finally(() => saving.delete(saveKey))
  saving.set(saveKey, promise)
  return promise
}

export const demoReleaseAccount: ReleaseAccount = { key: 'recapp.releases.demo', local: true }
export function officialReleaseAccount(kind: 'member' | 'owner', id: string | number): ReleaseAccount {
  return { key: `recapp.releases.${kind}.${id}`, local: false }
}
