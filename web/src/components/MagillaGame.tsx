import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createRunner, draw, jump, step, type Palette, type Phase, type Runner } from '../lib/magillaRun'

const BEST_KEY = 'recapp.magilla.best'

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function palette(node: HTMLElement): Palette {
  const style = getComputedStyle(node)
  return {
    paper: style.getPropertyValue('--color-paper').trim() || '#f6f4f1',
    surface: style.getPropertyValue('--color-surface').trim() || '#ffffff',
    ink: style.getPropertyValue('--color-ink').trim() || '#1d1b1e',
    muted: style.getPropertyValue('--color-muted').trim() || '#6b6570',
    bordeaux: style.getPropertyValue('--color-bordeaux').trim() || '#a02848',
    line: style.getPropertyValue('--color-line').trim() || '#e7e2de',
  }
}

function isControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [role="button"]'))
}

/** Side-scrolling Magilla. Idle until Space, ArrowUp, click or tap. */
export function MagillaGame() {
  const { t, i18n } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runnerRef = useRef<Runner | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const runner = createRunner(readBest(), reduced.matches)
    runnerRef.current = runner

    let frame = 0
    let last = 0
    let scoreTick = 0
    let looping = false

    const paint = () => {
      const ctx = canvas.getContext('2d')
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!ctx || width < 8 || height < 8) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const bw = Math.round(width * dpr)
      const bh = Math.round(height * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(ctx, runner, palette(canvas), width, height)
    }

    const stop = () => {
      looping = false
      cancelAnimationFrame(frame)
    }

    const loop = (now: number) => {
      if (!looping) return
      const dt = last ? (now - last) / 1000 : 0
      last = now
      step(runner, dt, canvas.clientWidth)
      paint()
      if (runner.phase === 'run') {
        scoreTick += dt
        if (scoreTick > 0.15) {
          scoreTick = 0
          setScore(runner.score)
        }
        frame = requestAnimationFrame(loop)
        return
      }
      stop()
      setPhase(runner.phase)
      setScore(runner.score)
      setBest(runner.best)
      if (runner.phase === 'over') {
        try {
          localStorage.setItem(BEST_KEY, String(runner.best))
        } catch {
          /* private mode */
        }
        setAnnounce(`${i18n.t('notFound.game.over')} ${i18n.t('notFound.game.score', { n: runner.score })}`)
      }
    }

    const start = () => {
      const before = runner.phase
      jump(runner)
      if (before !== 'run') {
        setPhase('run')
        setScore(0)
        setAnnounce('')
        if (!looping) {
          looping = true
          last = 0
          scoreTick = 0
          frame = requestAnimationFrame(loop)
        }
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== ' ' && event.key !== 'ArrowUp') return
      if (isControl(event.target)) return
      event.preventDefault()
      start()
    }

    const onPointer = (event: PointerEvent) => {
      event.preventDefault()
      start()
    }

    const onMotion = () => {
      runner.reduced = reduced.matches
      if (runner.phase !== 'run') paint()
    }

    paint()
    reduced.addEventListener('change', onMotion)
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onPointer)
    const theme = new MutationObserver(() => {
      if (runner.phase !== 'run') paint()
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const resize = new ResizeObserver(() => {
      if (runner.phase !== 'run') paint()
    })
    resize.observe(canvas)

    return () => {
      stop()
      reduced.removeEventListener('change', onMotion)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onPointer)
      theme.disconnect()
      resize.disconnect()
    }
  }, [i18n])

  return (
    <section className="mt-10 w-full" aria-labelledby="magilla-title">
      <h2 id="magilla-title" className="text-base font-extrabold tracking-tight sm:text-lg">
        {t('notFound.game.title')}
      </h2>
      <div className="mt-1 flex min-h-10 flex-col items-center justify-center">
        {phase === 'over' ? (
          <>
            <p className="text-sm font-extrabold"><span className="language-text">{t('notFound.game.over')}</span></p>
            <p className="text-xs font-medium text-muted"><span className="language-text">{t('notFound.game.again')}</span></p>
          </>
        ) : phase === 'idle' ? (
          <p className="text-sm font-semibold text-muted"><span className="language-text">{t('notFound.game.start')}</span></p>
        ) : (
          <p className="text-xs font-semibold text-muted"><span className="language-text">{t('notFound.game.score', { n: score })}</span></p>
        )}
      </div>
      <div className="relative mt-1 overflow-hidden rounded-2xl border border-line bg-paper">
        <canvas
          ref={canvasRef}
          className="block h-[250px] w-full touch-none"
          role="img"
          aria-label={t('notFound.game.aria')}
        />
        {phase !== 'idle' && (
          <p className="pointer-events-none absolute top-2 right-2 rounded-lg bg-paper/85 px-2 py-1 text-right text-xs font-bold tabular-nums text-ink">
            <span className="language-text">{t('notFound.game.score', { n: score })}</span>
            {best > 0 && <span className="mt-0.5 block font-semibold text-muted"><span className="language-text">{t('notFound.game.best', { n: best })}</span></span>}
          </p>
        )}
        {phase === 'idle' && best > 0 && (
          <p className="pointer-events-none absolute top-2 right-2 rounded-lg bg-paper/85 px-2 py-1 text-xs font-semibold text-muted">
            <span className="language-text">{t('notFound.game.best', { n: best })}</span>
          </p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </section>
  )
}
