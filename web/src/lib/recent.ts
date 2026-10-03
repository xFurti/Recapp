const KEY = 'ieri.recent'

export interface RecentClass {
  code: string
  label: string
  memberId: number
  nick: string
}

export function getRecent(): RecentClass | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as RecentClass
    if (!data.code || !data.memberId || !data.nick) return null
    return data
  } catch {
    return null
  }
}

export function rememberClass(recent: RecentClass) {
  localStorage.setItem(KEY, JSON.stringify(recent))
}
