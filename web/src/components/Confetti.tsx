import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const COLORS = ['#A02848', '#F8B828', '#1898C8', '#80B830', '#E01058', '#8038B8']
const BURST_MS = 1400

type Piece = {
  id: number
  color: string
  dx: number
  lift: number
  dy: number
  rot: number
  w: number
  h: number
  round: boolean
  delay: number
}

function pieces(count: number): Piece[] {
  const reach = Math.min(window.innerWidth * 0.46, 520)
  return Array.from({ length: count }, (_, id) => {
    const side = id % 2 === 0 ? -1 : 1
    const spread = 0.25 + Math.random() * 0.75
    return {
      id,
      color: COLORS[id % COLORS.length]!,
      dx: side * (36 + spread * reach) * (0.55 + Math.random() * 0.45),
      lift: -(70 + Math.random() * 150),
      dy: 160 + Math.random() * 280,
      rot: (Math.random() * 2 - 1) * 420,
      w: 7 + Math.random() * 5,
      h: Math.random() > 0.45 ? 8 + Math.random() * 8 : 7 + Math.random() * 4,
      round: Math.random() > 0.62,
      delay: Math.random() * 40,
    }
  })
}

/** A short burst from the middle of the screen. Decorative only. */
export function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const [bits] = useState(() => pieces(40))
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(onDone, reduced ? 0 : BURST_MS)
    return () => window.clearTimeout(id)
  }, [onDone])

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden>
      {bits.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{ '--dx': `${p.dx}px`, animationDelay: `${p.delay}ms` } as CSSProperties}
        >
          <i
            className="confetti-bit"
            style={
              {
                backgroundColor: p.color,
                width: p.w,
                height: p.round ? p.w : p.h,
                borderRadius: p.round ? 999 : 2,
                animationDelay: `${p.delay}ms`,
                '--lift': `${p.lift}px`,
                '--dy': `${p.dy}px`,
                '--rot': `${p.rot}deg`,
              } as CSSProperties
            }
          />
        </span>
      ))}
    </div>,
    document.body,
  )
}
