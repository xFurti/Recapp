import type { Page } from '@playwright/test'
import type { ClassInfo, MemberRow } from '../src/types'

export type MemberOptions = { lang?: 'it' | 'en'; width?: number; dark?: boolean; viewer?: 'member' | 'admin' | 'owner'; demo?: boolean }

// Fictional identities: supported 16-character limit, Unicode and unbroken names.
export const members: MemberRow[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  nick: index < 8
    ? ['WWWWWWWWWWWWWWWW', 'Èléonora-DÁngelo', 'Ada', 'Luca', 'Marta', 'Tommaso', 'Sofia', 'Gabriele'][index]
    : `Partecipante-${String(index + 1).padStart(2, '0')}`,
  color: ['#A02848', '#1898C8', '#8038B8', '#4A7512'][index % 4],
  role: index % 4 === 0 ? 'admin' : 'member',
  activated: index % 5 !== 2,
  needs_setup: index % 5 === 2,
  rotation_order: index,
  is_today_scribe: index === 0,
  days_written: index % 5 === 2 ? 0 : index % 4 === 0 ? 12 : 0,
  items_added: index % 5 === 2 ? 0 : index % 4 === 0 ? 134 : index % 3,
  is_me: index === 0,
}))

export async function setupMembers(page: Page, { lang = 'it', width = 390, dark = false, viewer = 'admin', demo = false }: MemberOptions = {}) {
  await page.setViewportSize({ width, height: 900 })
  await page.addInitScript(({ lang, dark }) => {
    localStorage.setItem('ieri.lang', lang)
    localStorage.setItem('ieri.theme', dark ? 'dark' : 'light')
    localStorage.setItem('ieri.simulatedNow', '2026-10-14T16:00')
  }, { lang, dark })
  const info: ClassInfo = {
    code: 'TEST', name: '4BI', label: '4ª BI · Informatica', is_demo: demo, subjects: [], hours: [],
    viewer: {
      kind: viewer === 'owner' ? 'owner' : 'member',
      member: viewer === 'owner' ? null : { id: 1, nick: members[0].nick, color: members[0].color, role: viewer },
      can_manage: viewer !== 'member', read_only: false, tour_seen: true,
    },
  }
  const calls: { method: string; path: string; body: unknown }[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const method = route.request().method()
    if (method !== 'GET') {
      calls.push({ method, path, body: route.request().postDataJSON() })
      if (path.endsWith('/reset-invite')) return route.fulfill({ json: { member_id: 2, nick: members[1].nick, invite: 'TEST-ONLY', join_url: 'https://example.test/join' } })
      return route.fulfill({ json: { ok: true } })
    }
    const routes: Record<string, unknown> = {
      '/classes/TEST': info,
      '/me': viewer === 'owner' ? { kind: 'owner', owner: { username: 'test', display_name: 'Test' } } : { kind: 'member', member: info.viewer.member, classroom: info },
      '/classes/TEST/members': { members: members.map(m => ({ ...m, is_me: viewer !== 'owner' && m.id === 1 })), can_manage: viewer !== 'member' },
      '/classes/TEST/contributions': {
        period: { kind: 'school_year', label: '2026/27', start: '2026-09-10', end: '2027-06-08' },
        streak: { current: 0, record: 0, has_published: false, today: '2026-10-14', days: [] },
        ranking: [], totals: { thanks: 0, days_published: 0, items_added: 0 },
      },
    }
    return route.fulfill(path in routes ? { json: routes[path] } : { status: 404, json: { detail: `Unexpected test request: ${path}` } })
  })
  return calls
}
