import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { UNSAFE_ViewTransitionContext as ViewTransitionContext, useLocation } from 'react-router'
import { discardPageClone, pageWipeEnabled, PAGE_WIPE_MS, reducedMotion, stashPageClone, takePageClone } from '../lib/pageWipe'

type Phase = 'idle' | 'cover' | 'reveal'

/**
 * Clip wipe over the class page only. The router swaps immediately, so the new
 * page mounts and starts loading under the panel; the snapshot of the old page
 * stays visible until the panel has covered it.
 */
export function PageStage({ children }: { children: ReactNode }) {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const pathRef = useRef(location.pathname)
  const phaseRef = useRef<Phase>('idle')
  const timers = useRef<number[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [overlay, setOverlay] = useState<HTMLElement | null>(null)
  const vt = useContext(ViewTransitionContext)

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  const begin = (clone: HTMLElement) => {
    clearTimers()
    phaseRef.current = 'cover'
    setOverlay(clone)
    setPhase('cover')
    timers.current = [
      window.setTimeout(() => {
        phaseRef.current = 'reveal'
        setPhase('reveal')
        setOverlay(null)
        mainRef.current?.focus({ preventScroll: true })
      }, PAGE_WIPE_MS),
      window.setTimeout(() => {
        phaseRef.current = 'idle'
        setPhase('idle')
      }, PAGE_WIPE_MS * 2),
    ]
  }

  useLayoutEffect(() => {
    if (location.pathname === pathRef.current) {
      discardPageClone()
      return
    }
    pathRef.current = location.pathname
    const clone = takePageClone()
    if (!clone || reducedMotion()) return
    if (phaseRef.current === 'cover') return
    begin(clone)
  })

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (!pageWipeEnabled(pathRef.current, url.pathname)) return
      if (phaseRef.current === 'cover') return
      stashPageClone()
    }
    const onPop = () => {
      if (phaseRef.current === 'cover') return
      if (!pageWipeEnabled(pathRef.current, window.location.pathname)) return
      stashPageClone()
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  // When a view transition is not running, move focus once the path has settled.
  const seen = useRef<string | null>(null)
  useEffect(() => {
    if (seen.current === null) {
      seen.current = location.pathname
      return
    }
    if (vt.isTransitioning || phase !== 'idle') return
    if (seen.current === location.pathname) return
    seen.current = location.pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname, phase, vt.isTransitioning])

  const wiping = phase !== 'idle'
  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      className={`page-stage mx-auto max-w-3xl px-4 pb-28 pt-5 focus-visible:outline-none md:pb-12 ${phase === 'cover' ? 'is-covering' : ''} ${phase === 'reveal' ? 'is-revealing' : ''}`}
    >
      <div className="grid">
        {overlay && (
          <div
            className="col-start-1 row-start-1"
            aria-hidden
            ref={(node) => {
              if (node && node.firstChild !== overlay) node.replaceChildren(overlay)
            }}
          />
        )}
        <div
          data-page-live
          className={`col-start-1 row-start-1 ${phase === 'cover' ? 'invisible' : ''}`}
          inert={phase === 'cover' ? true : undefined}
          aria-hidden={phase === 'cover' ? true : undefined}
        >
          {children}
        </div>
      </div>
      <div aria-hidden className="page-curtain" style={wiping ? { animationDuration: `${PAGE_WIPE_MS}ms` } : undefined} />
    </main>
  )
}
