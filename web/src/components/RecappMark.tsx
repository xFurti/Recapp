import type { CSSProperties } from 'react'
import page1 from '../assets/recapp-page-1.png'
import page2 from '../assets/recapp-page-2.png'
import page3 from '../assets/recapp-page-3.png'
import page4 from '../assets/recapp-page-4.png'
import page5 from '../assets/recapp-page-5.png'
import page6 from '../assets/recapp-page-6.png'

/** One full flip of all pages; the keyframes in index.css are written as fractions of it. */
export const RECAPP_MARK_MS = 560

// The left edge of each page is its turning point; the cover is drawn last.
const PAGES = [page1, page2, page3, page4, page5, page6].map((src, i) => ({ src, spine: [0, 14, 27.6, 41.3, 56.2, 72.8][i] }))

/** The same layered mark in navigation and update notices. */
export function RecappMark({ playing = false, className }: { playing?: boolean; className: string }) {
  return (
    <span aria-hidden className={`nav-icon recapp-mark ${className}`} data-motion="logo" data-playing={playing || undefined} style={{ '--nav-icon-ms': `${RECAPP_MARK_MS}ms` } as CSSProperties}>
      {[...PAGES].reverse().map(({ src, spine }, turn) => (
        <img key={src} src={src} alt="" style={{ '--turn': turn, '--spine': `${spine}%` } as CSSProperties} />
      ))}
    </span>
  )
}
