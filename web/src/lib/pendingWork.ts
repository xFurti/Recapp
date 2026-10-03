import { useEffect, useRef } from 'react'

type Work = { dirty: () => boolean; flush: () => Promise<unknown> }

const works = new Set<{ current: Work }>()

/** Lets a page with unsaved changes (or a save in flight) be saved before the app reloads itself. */
export function usePendingWork(work: Work) {
  const ref = useRef(work)
  useEffect(() => {
    ref.current = work
  })
  useEffect(() => {
    works.add(ref)
    return () => void works.delete(ref)
  }, [])
}

/** Saves everything pending. Rejects if anything is still unsaved afterwards, so the caller must not reload. */
export async function flushPendingWork() {
  for (const { current } of works) {
    if (current.dirty()) await current.flush()
  }
  if ([...works].some(({ current }) => current.dirty())) throw new Error('unsaved')
}
