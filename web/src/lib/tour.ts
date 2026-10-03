import type { QueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { classPath } from '../queries'
import type { ClassInfo } from '../types'

// Demo nicks are shared by every visitor, so the demo remembers the tour per browser
// (one key for all demo sessions, private ones included). Real accounts store it on the server.
const DEMO_KEY = 'recapp.tour.demo'
const accountKey = (info: ClassInfo, memberId: number) => `recapp.tour.${info.code}.${memberId}`

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Storage blocked: the server copy (or this session) is all we get.
  }
}

/** Whether to skip the automatic first-visit tour. The school view never gets it automatically. */
export function tourSeen(info: ClassInfo) {
  const member = info.viewer.member
  if (!member) return true
  if (info.is_demo) return readFlag(DEMO_KEY)
  // The local copy only covers a failed save; it is keyed per account so classmates on this device still get the tour.
  return info.viewer.tour_seen || readFlag(accountKey(info, member.id))
}

/** Called on finish and on skip alike: either way the tour is not offered again automatically. */
export function markTourSeen(info: ClassInfo, qc: QueryClient) {
  const member = info.viewer.member
  if (!member) return
  if (info.is_demo) {
    writeFlag(DEMO_KEY)
    return
  }
  writeFlag(accountKey(info, member.id))
  qc.setQueryData<ClassInfo>(['class', info.code], (old) => (old ? { ...old, viewer: { ...old.viewer, tour_seen: true } } : old))
  api.post(classPath(info.code, '/tour')).catch(() => undefined)
}
