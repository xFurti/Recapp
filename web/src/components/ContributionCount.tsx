import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/contribution-motion'

/** The accessible text and reserved width always contain the final value. */
export function ContributionCount({ value, text = String(value) }: { value: number; text?: string }) {
  const reduced = useReducedMotion()
  const previous = useRef(reduced ? value : 0)
  const [displayed, setDisplayed] = useState(() => reduced ? value : 0)
  useEffect(() => {
    const from = previous.current
    if (reduced) {
      previous.current = value
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 560)
      const next = Math.round(from + (value - from) * (1 - (1 - progress) ** 3))
      previous.current = next
      setDisplayed(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  const at = text.indexOf(String(value))
  if (at < 0) return <>{text}</>
  return (
    <span className="contribution-count">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, at)}<span className="contribution-number" data-final={value} data-value={reduced ? value : displayed} />{text.slice(at + String(value).length)}
      </span>
    </span>
  )
}
