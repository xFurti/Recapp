import { ChevronsDown, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BANANA_POINTS,
  createGame,
  duck,
  GROUND,
  jumpDown,
  jumpUp,
  PLAYER_X,
  score,
  setPaused,
  step,
  WINDOW_FLOOR,
  WORLD_H,
  type Game,
  type ObstacleKind,
  type Phase,
} from '../../lib/magilla-game'
import { setSoundOn, sfx, soundOn, unlockSound } from '../../lib/magilla-sound'
import { ConfettiBurst } from '../Confetti'
import { act, chomp, crashed, createActing, landed, tookOff } from './animate'
import { HatShape, MagillaSprite, Star } from './MagillaSprite'
import { applyPose, type Parts } from './rig'
import {
  BANANA,
  BananaShape,
  Cloud,
  Crates,
  Glass,
  Hydrant,
  Lamp,
  Pigeon,
  PriceTag,
  ShopBack,
  ShopFront,
  Skyline,
  Stack,
  TrashCan,
} from './props'

const BEST_KEY = 'recapp.magilla.best'
const SVG_NS = 'http://www.w3.org/2000/svg'
const RESTART_LOCK_S = 0.45

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}
function saveBest(value: number) {
  try {
    localStorage.setItem(BEST_KEY, String(value))
  } catch {
    /* private mode */
  }
}

const pad = (n: number) => String(Math.min(99999, n)).padStart(5, '0')
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3

type Effect = { el: SVGElement; age: number; life: number; tick: (dt: number, age: number) => void }

type Result = { score: number; best: number; record: boolean }

export default function MagillaGame() {
  const { t } = useTranslation()
  const uid = useId().replace(/:/g, '')
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<SVGGElement>(null)
  const partsRef = useRef<Parts | null>(null)
  const playerRef = useRef<SVGGElement>(null)
  const shadowRef = useRef<SVGEllipseElement>(null)
  const shopRef = useRef<SVGGElement>(null)
  const shopFrontRef = useRef<SVGGElement>(null)
  const glassRef = useRef<SVGGElement>(null)
  const tagRef = useRef<SVGGElement>(null)
  const cloudsRef = useRef<SVGGElement>(null)
  const skylineRef = useRef<SVGGElement>(null)
  const lampsRef = useRef<SVGGElement>(null)
  const groundRef = useRef<SVGGElement>(null)
  const itemsRef = useRef<SVGGElement>(null)
  const obstaclesRef = useRef<SVGGElement>(null)
  const fxRef = useRef<SVGGElement>(null)
  const templatesRef = useRef<SVGGElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const bananasRef = useRef<HTMLSpanElement>(null)

  const [initialGame] = useState(() => createGame(readBest()))
  const gameRef = useRef<Game>(initialGame)
  const widthRef = useRef(560)
  const lookRef = useRef<[number, number] | null>(null)
  const startBestRef = useRef(0)
  const overAtRef = useRef(0)
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const [width, setWidth] = useState(560)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [sound, setSound] = useState(soundOn)
  const [confetti, setConfetti] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches)
  const [best, setBest] = useState(initialGame.best)

  // World width follows the stage; the height is always WORLD_H.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry!.contentRect
      if (!w || !h) return
      const next = Math.round((WORLD_H * w) / h)
      widthRef.current = next
      setWidth(next)
    })
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  const begin = useCallback(() => {
    const game = gameRef.current
    if (game.phase === 'over' && game.time - overAtRef.current < RESTART_LOCK_S) return false
    if (game.phase === 'idle' || game.phase === 'over') {
      unlockSound()
      startBestRef.current = game.best
      setResult(null)
    }
    jumpDown(game, widthRef.current)
    return true
  }, [])

  // The game loop. Everything per-frame goes straight to the DOM.
  useEffect(() => {
    const game = gameRef.current
    const acting = createActing()
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const obstacleNodes = new Map<number, SVGGElement>()
    const itemNodes = new Map<number, SVGGElement>()
    let effects: Effect[] = []
    let raf = 0
    let last = performance.now()
    let shakeUntil = 0
    let startAt = -1
    let shownScore = -1
    let shownBananas = -1
    let visible = true

    const template = (name: string) => templatesRef.current!.querySelector<SVGGElement>(`[data-t="${name}"]`)!
    const make = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
      const el = document.createElementNS(SVG_NS, tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
      return el
    }
    const addEffect = (el: SVGElement, life: number, tick: Effect['tick']) => {
      fxRef.current!.appendChild(el)
      effects.push({ el, age: 0, life, tick })
      tick(0, 0)
    }

    const dust = (x: number, size: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const el = make('circle', { r: 1, class: 'fill-muted' })
        let px = x - i * 4 + Math.random() * 3
        const py = GROUND - 1 - Math.random() * 3
        const rise = 4 + Math.random() * 5
        const r = size * (0.7 + Math.random() * 0.6)
        addEffect(el, 0.45, (dt, age) => {
          px -= game.speed * dt * (game.phase === 'running' ? 0.75 : 0)
          const u = age / 0.45
          el.setAttribute('cx', px.toFixed(1))
          el.setAttribute('cy', (py - rise * easeOut(u)).toFixed(1))
          el.setAttribute('r', (r * (0.4 + easeOut(u) * 0.8)).toFixed(2))
          el.setAttribute('opacity', (0.38 * (1 - u)).toFixed(2))
        })
      }
    }

    const pop = (x: number, y: number) => {
      const text = make('text', { x, y, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, class: 'fill-bordeaux', stroke: 'var(--color-surface)', 'stroke-width': 3, 'paint-order': 'stroke' })
      text.textContent = `+${BANANA_POINTS}`
      addEffect(text, 0.7, (_dt, age) => {
        const u = age / 0.7
        text.setAttribute('y', (y - 22 * easeOut(u)).toFixed(1))
        text.setAttribute('opacity', (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4).toFixed(2))
      })
      for (let i = 0; i < 6; i++) {
        const spark = template('spark').cloneNode(true) as SVGGElement
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5
        addEffect(spark, 0.45, (_dt, age) => {
          const u = age / 0.45
          const d = 6 + 14 * easeOut(u)
          spark.setAttribute('transform', `translate(${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}) scale(${(1 - u).toFixed(2)})`)
        })
      }
    }

    const flyHat = (x: number, y: number) => {
      const hat = template('hat').cloneNode(true) as SVGGElement
      let px = x
      let py = y
      let vx = 70
      let vy = -330
      let rot = -9
      let spin = 900
      let resting = false
      addEffect(hat, Infinity, (dt) => {
        if (!resting) {
          vy += 1500 * dt
          px += vx * dt
          py += vy * dt
          rot += spin * dt
          if (py >= GROUND - 2.4 && vy > 0) {
            py = GROUND - 2.4
            vy *= -0.38
            vx *= 0.5
            spin *= 0.35
            if (Math.abs(vy) < 60) {
              resting = true
              rot = -8
            }
          }
        }
        hat.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${rot.toFixed(1)})`)
      })
    }

    const clearEffects = () => {
      for (const e of effects) e.el.remove()
      effects = []
    }

    const sync = <T extends { id: number }>(
      list: T[],
      nodes: Map<number, SVGGElement>,
      layer: SVGGElement,
      create: (item: T) => SVGGElement,
      place: (node: SVGGElement, item: T) => void,
    ) => {
      const alive = new Set<number>()
      for (const item of list) {
        alive.add(item.id)
        let node = nodes.get(item.id)
        if (!node) {
          node = create(item)
          nodes.set(item.id, node)
          layer.appendChild(node)
        }
        place(node, item)
      }
      for (const [id, node] of nodes) {
        if (!alive.has(id)) {
          node.remove()
          nodes.delete(id)
        }
      }
    }

    const handleEvents = () => {
      const p = game.player
      for (const ev of game.events) {
        switch (ev.type) {
          case 'start':
            startAt = game.time
            if (!game.fromWindow) clearEffects()
            tookOff(acting)
            sfx.start()
            setPhase('running')
            break
          case 'jump':
            tookOff(acting)
            sfx.jump()
            break
          case 'land':
            landed(acting, ev.hard)
            dust(PLAYER_X, ev.hard ? 4 : 3, ev.hard ? 4 : 2)
            if (ev.hard) sfx.land()
            break
          case 'banana':
            chomp(acting, game.time)
            pop(ev.x, ev.y)
            sfx.banana()
            bananasRef.current?.parentElement?.classList.remove('mg-bump')
            void bananasRef.current?.parentElement?.getBoundingClientRect()
            bananasRef.current?.parentElement?.classList.add('mg-bump')
            break
          case 'milestone':
            sfx.milestone()
            scoreRef.current?.classList.remove('mg-flash')
            void scoreRef.current?.getBoundingClientRect()
            scoreRef.current?.classList.add('mg-flash')
            break
          case 'crash': {
            crashed(acting, game.time)
            overAtRef.current = game.time
            flyHat(PLAYER_X + 8, p.y - 80)
            if (!calm) shakeUntil = game.time + 0.32
            sfx.crash()
            navigator.vibrate?.(60)
            const final = score(game)
            const record = final > startBestRef.current && final > 0
            if (record) saveBest(final)
            setBest(game.best)
            setResult({ score: final, best: game.best, record })
            if (record && startBestRef.current > 0) setConfetti(true)
            setPhase('over')
            setAnnounce(tRef.current('notFound.game.announce_over', { score: final }))
            break
          }
        }
      }
      game.events.length = 0
    }

    const render = (dt: number) => {
      const s = game.scroll
      const time = game.time
      const p = game.player

      // Parallax
      const wrap = (v: number, m: number) => -(((v % m) + m) % m)
      cloudsRef.current?.setAttribute('transform', `translate(${wrap(s * 0.06 + time * 5, 640).toFixed(1)} 0)`)
      skylineRef.current?.setAttribute('transform', `translate(${wrap(s * 0.2, 640).toFixed(1)} 0)`)
      lampsRef.current?.setAttribute('transform', `translate(${wrap(s * 0.55, 320).toFixed(1)} 0)`)
      groundRef.current?.setAttribute('transform', `translate(${wrap(s, 64).toFixed(1)} 0)`)

      // The shop, only on the first run, until it leaves the screen.
      const showShop = game.fromWindow && s < 420
      for (const el of [shopRef.current, shopFrontRef.current]) {
        if (!el) continue
        el.style.display = showShop ? '' : 'none'
        el.setAttribute('transform', `translate(${(-s).toFixed(1)} 0)`)
      }
      if (showShop) {
        const sash = startAt < 0 ? 0 : easeOut((time - startAt) / 0.24)
        glassRef.current?.setAttribute('transform', `translate(0 ${(-(WINDOW_FLOOR - 84) * sash).toFixed(1)})`)
        const swing = startAt < 0 ? Math.sin(time * 1.7) * 5 : Math.sin((time - startAt) * 9) * 22 * Math.exp(-(time - startAt) * 2.4)
        tagRef.current?.setAttribute('transform', `translate(150 84) rotate(${swing.toFixed(2)})`)
      }

      // Bananas and obstacles
      sync(
        game.items,
        itemNodes,
        itemsRef.current!,
        () => template('banana').cloneNode(true) as SVGGElement,
        (node, b) => {
          const bob = Math.sin(time * 5 + b.id) * 2
          node.setAttribute('transform', `translate(${(b.x - s).toFixed(1)} ${(b.y + bob).toFixed(1)}) rotate(${(Math.sin(time * 3 + b.id) * 10).toFixed(1)})`)
        },
      )
      sync(
        game.obstacles,
        obstacleNodes,
        obstaclesRef.current!,
        (o) => template(o.kind satisfies ObstacleKind).cloneNode(true) as SVGGElement,
        (node, o) => {
          node.setAttribute('transform', `translate(${(o.x - s).toFixed(1)} ${o.y})`)
          if (o.kind === 'pigeon') {
            const wing = node.querySelector('[data-wing]')
            const flap = game.phase === 'running' ? Math.sin(time * 22 + o.id) : 0.4
            wing?.setAttribute('transform', `translate(0 -12) scale(1 ${flap.toFixed(2)}) translate(0 12)`)
          }
        },
      )

      // Magilla
      const parts = partsRef.current
      if (parts) {
        acting.lookTarget = game.phase === 'idle' ? lookRef.current : null
        const pose = act(game, acting, dt, calm)
        applyPose(parts, pose, time)
        if (acting.stepped && game.phase === 'running' && !p.airborne && !calm) dust(PLAYER_X - 6, 2.2, 1)
        const floor = game.phase === 'idle' ? WINDOW_FLOOR : GROUND
        const lift = Math.max(0, floor - pose.y)
        const k = Math.max(0.35, 1 - lift / 110)
        shadowRef.current?.setAttribute('transform', `translate(${(pose.x + (p.ducking ? 6 : 2)).toFixed(1)} ${floor + 0.5}) scale(${(k * (p.ducking ? 1.35 : 1)).toFixed(2)} 1)`)
        shadowRef.current?.setAttribute('opacity', (0.22 * k).toFixed(2))
      }

      // Effects
      effects = effects.filter((e) => {
        e.age += dt
        if (e.age >= e.life) {
          e.el.remove()
          return false
        }
        e.tick(dt, e.age)
        return true
      })

      // Shake on a crash
      const shaking = time < shakeUntil
      worldRef.current?.setAttribute(
        'transform',
        shaking ? `translate(${((Math.random() - 0.5) * 5).toFixed(1)} ${((Math.random() - 0.5) * 4).toFixed(1)})` : '',
      )

      // HUD
      const now = score(game)
      if (now !== shownScore && scoreRef.current) {
        shownScore = now
        scoreRef.current.textContent = pad(now)
      }
      if (game.bananas !== shownBananas && bananasRef.current) {
        shownBananas = game.bananas
        bananasRef.current.textContent = String(game.bananas)
      }
    }

    const frame = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      if (visible) {
        step(game, dt, widthRef.current)
        handleEvents()
        render(game.phase === 'paused' ? 0 : dt)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const pause = () => {
      if (game.phase !== 'running') return
      setPaused(game, true)
      setPhase('paused')
      duck(game, false)
      jumpUp(game)
    }
    const onVisibility = () => {
      if (document.hidden) pause()
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = entry!.isIntersecting
      if (!visible) pause()
    })
    if (stageRef.current) io.observe(stageRef.current)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', pause)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target instanceof HTMLElement ? e.target : null
      const stage = stageRef.current
      const onStage = target === stage
      if (!onStage && target?.closest('input, textarea, select, button, a, summary, [contenteditable="true"], [role="dialog"]')) return
      switch (e.code) {
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault()
          if (e.repeat) return
          if (game.phase === 'paused') {
            setPaused(game, false)
            setPhase('running')
            return
          }
          begin()
          break
        case 'Enter':
          if (onStage && (game.phase === 'idle' || game.phase === 'over' || game.phase === 'paused')) {
            e.preventDefault()
            if (game.phase === 'paused') {
              setPaused(game, false)
              setPhase('running')
            } else begin()
          }
          break
        case 'ArrowDown':
        case 'KeyS':
          if (game.phase === 'running') {
            e.preventDefault()
            duck(game, true)
          }
          break
        case 'Escape':
        case 'KeyP':
          if (game.phase === 'running') pause()
          else if (game.phase === 'paused') {
            setPaused(game, false)
            setPhase('running')
          }
          break
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jumpUp(game)
      if (e.code === 'ArrowDown' || e.code === 'KeyS') duck(game, false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', pause)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clearEffects()
      for (const node of [...obstacleNodes.values(), ...itemNodes.values()]) node.remove()
    }
  }, [begin])

  const resume = () => {
    setPaused(gameRef.current, false)
    setPhase('running')
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (gameRef.current.phase === 'paused') return resume()
    begin()
  }
  const onPointerUp = () => jumpUp(gameRef.current)
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const rect = e.currentTarget.getBoundingClientRect()
    const wx = ((e.clientX - rect.left) / rect.width) * widthRef.current
    const wy = ((e.clientY - rect.top) / rect.height) * WORLD_H
    const ex = PLAYER_X + 14
    const ey = gameRef.current.player.y - 70
    lookRef.current = [Math.max(-1.1, Math.min(1.1, (wx - ex) / 40)), Math.max(-1, Math.min(1, (wy - ey) / 40))]
  }

  const duckPad = {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      duck(gameRef.current, true)
    },
    onPointerUp: () => {
      duck(gameRef.current, false)
    },
    onPointerCancel: () => duck(gameRef.current, false),
  }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    setSoundOn(next)
    if (next) unlockSound()
  }

  const instructions = `${uid}-help`
  const W = width

  return (
    <div className="w-full">
      <div
        ref={stageRef}
        role="application"
        aria-roledescription={t('notFound.game.role')}
        aria-label={t('notFound.game.label')}
        aria-describedby={instructions}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerLeave={() => (lookRef.current = null)}
        className="mg-stage relative aspect-[16/9] w-full cursor-pointer touch-manipulation select-none overflow-hidden rounded-2xl border border-line bg-linear-to-b from-azzurro-soft via-paper to-paper shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-azzurro/40 sm:aspect-[3/1]"
      >
        <svg viewBox={`0 0 ${W} ${WORLD_H}`} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <clipPath id={`${uid}-window`}>
              <rect x={42} y={84} width={128} height={WINDOW_FLOOR - 84} />
            </clipPath>
            <g ref={templatesRef}>
              <g data-t="hydrant"><Hydrant /></g>
              <g data-t="can"><TrashCan /></g>
              <g data-t="crates"><Crates /></g>
              <g data-t="stack"><Stack /></g>
              <g data-t="pigeon"><Pigeon /></g>
              <g data-t="banana">
                <circle r={11} fill={BANANA} opacity={0.22} className="mg-glow" />
                <BananaShape />
              </g>
              <g data-t="hat"><HatShape /></g>
              <g data-t="spark"><Star size={2.6} /></g>
            </g>
          </defs>

          <g ref={worldRef}>
            {/* Sky: sun by day, moon and stars by night (follows the app theme) */}
            <g className="dark:hidden">
              <circle cx={W - 64} cy={46} r={26} className="fill-giallo/15" />
              <circle cx={W - 64} cy={46} r={16} className="fill-giallo/50" />
            </g>
            <g className="hidden dark:block">
              {Array.from({ length: Math.ceil(W / 40) }, (_, i) => (
                <circle
                  key={i}
                  cx={(i * 40 + ((i * 53) % 31)).toFixed(0)}
                  cy={10 + ((i * 37) % 90)}
                  r={(i % 3) * 0.35 + 0.6}
                  className="mg-twinkle fill-ink/70"
                  style={{ animationDelay: `${(i % 7) * 0.45}s` }}
                />
              ))}
              <path transform={`translate(${W - 64} 44)`} d="M 6 -15 A 16 16 0 1 0 15 7 A 12 12 0 1 1 6 -15 Z" className="fill-giallo/80" />
            </g>
            <g ref={cloudsRef}>
              {[0, 640, 1280].map((x) => (
                <g key={x} transform={`translate(${x} 0)`}>
                  <Cloud x={90} y={40} s={1.1} />
                  <Cloud x={330} y={24} s={0.8} />
                  <Cloud x={520} y={58} s={1} />
                </g>
              ))}
            </g>
            <g ref={skylineRef} opacity={0.9}>
              {[0, 640, 1280].map((x) => (
                <g key={x} transform={`translate(${x} 0)`}>
                  <Skyline />
                </g>
              ))}
            </g>
            <g ref={lampsRef}>
              {Array.from({ length: Math.ceil(W / 320) + 2 }, (_, i) => (
                <Lamp key={i} x={i * 320 + 250} />
              ))}
            </g>

            {/* Street */}
            <rect x={0} y={GROUND} width={W} height={WORLD_H - GROUND} className="fill-surface" />
            <rect x={0} y={GROUND + 22} width={W} height={WORLD_H - GROUND - 22} className="fill-line" />
            <g ref={groundRef}>
              {Array.from({ length: Math.ceil(W / 64) + 2 }, (_, i) => (
                <g key={i} transform={`translate(${i * 64} 0)`}>
                  <path d={`M 0 ${GROUND} L -6 ${GROUND + 22}`} className="stroke-line" strokeWidth={1.5} />
                  <circle cx={22} cy={GROUND + 7} r={0.9} className="fill-muted/40" />
                  <circle cx={47} cy={GROUND + 14} r={0.7} className="fill-muted/40" />
                  <rect x={14} y={GROUND + 29} width={26} height={2.4} rx={1.2} className="fill-surface/80" />
                </g>
              ))}
            </g>
            <path d={`M 0 ${GROUND} H ${W}`} className="stroke-ink/60" strokeWidth={1.6} />
            <path d={`M 0 ${GROUND + 22} H ${W}`} className="stroke-ink/25" strokeWidth={1.2} />

            <g ref={shopRef}>
              <ShopBack />
            </g>

            <g ref={itemsRef} />
            <g ref={obstaclesRef} />

            <ellipse ref={shadowRef} rx={17} ry={2.6} className="fill-ink" opacity={0.2} />
            <g ref={playerRef}>
              <MagillaSprite partsRef={partsRef} />
            </g>

            <g ref={shopFrontRef}>
              <g clipPath={`url(#${uid}-window)`}>
                <g ref={glassRef}>
                  <Glass />
                </g>
              </g>
              <ShopFront />
              <g ref={tagRef} transform="translate(150 84)">
                <PriceTag />
              </g>
            </g>

            <g ref={fxRef} />
          </g>
        </svg>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex h-8 items-center gap-1 rounded-full border border-line bg-surface/85 pl-1.5 pr-2.5 text-sm font-bold tabular-nums text-ink backdrop-blur transition-opacity ${phase === 'idle' ? 'opacity-0' : 'opacity-100'}`}
              aria-label={t('notFound.game.bananas')}
            >
              <svg viewBox="-11 -8 22 16" className="h-4 w-5" aria-hidden>
                <BananaShape />
              </svg>
              <span ref={bananasRef}>0</span>
            </span>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="flex items-center gap-3 rounded-full bg-surface/70 px-2.5 py-1 font-mono text-xs font-bold tabular-nums tracking-wider text-muted backdrop-blur sm:text-sm">
              <span>
                <span className="mr-1.5">{t('notFound.game.best_short')}</span>
                <span>{pad(best)}</span>
              </span>
              <span ref={scoreRef} className="text-ink">
                00000
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSound}
              className="flex size-8 items-center justify-center rounded-full border border-line bg-surface/85 text-muted backdrop-blur hover:text-ink"
              aria-label={t(sound ? 'notFound.game.sound_off' : 'notFound.game.sound_on')}
              title={t(sound ? 'notFound.game.sound_off' : 'notFound.game.sound_on')}
            >
              {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            </button>
          </div>
        </div>

        {phase === 'idle' && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[48%] items-center justify-center p-3 sm:w-[60%]">
            <div className="mg-float flex flex-col items-center gap-2 text-center">
              <p className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-paper shadow-md sm:px-4 sm:py-2 sm:text-sm">
                {t(coarse ? 'notFound.game.start_touch' : 'notFound.game.start')}
              </p>
              {!coarse && (
                <p className="hidden items-center gap-1.5 text-xs font-medium text-muted sm:flex">
                  <kbd className="mg-key">Space</kbd>
                  <kbd className="mg-key">↑</kbd>
                  <span>{t('notFound.game.jump')}</span>
                  <kbd className="mg-key ml-2">↓</kbd>
                  <span>{t('notFound.game.duck_hint')}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/40 backdrop-blur-[2px]">
            <div className="text-center">
              <p className="text-lg font-extrabold">{t('notFound.game.paused')}</p>
              <p className="mt-1 text-xs font-medium text-muted sm:text-sm">{t(coarse ? 'notFound.game.resume_touch' : 'notFound.game.resume')}</p>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <div className="pointer-events-none absolute inset-y-0 right-0 left-[34%] flex items-center justify-center p-2 pt-9 sm:left-[28%] sm:pt-10">
            <div className="mg-pop flex flex-col items-center rounded-2xl bg-surface/85 px-4 py-3 text-center shadow-md ring-1 ring-line backdrop-blur sm:px-6 sm:py-4">
              <p className="text-[15px] font-extrabold leading-tight tracking-tight sm:text-xl">
                “{t('notFound.game.over_title')}”
              </p>
              <p className="mt-1 text-xs font-medium text-muted sm:text-sm">
                {result.record ? (
                  <span className="font-bold text-bordeaux">{t('notFound.game.new_best', { score: result.score })}</span>
                ) : (
                  t('notFound.game.over_score', { score: result.score, best: result.best })
                )}
              </p>
              <button
                type="button"
                onClick={() => begin()}
                className="btn-spring pointer-events-auto mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-bordeaux px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-bordeaux-dark sm:mt-3 sm:h-10 sm:px-4"
              >
                <RotateCcw className="size-4" aria-hidden />
                {t('notFound.game.again')}
              </button>
            </div>
          </div>
        )}

        {coarse && phase === 'running' && (
          <button
            type="button"
            {...duckPad}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute bottom-2 left-2 flex size-12 touch-none select-none items-center justify-center rounded-full border border-line bg-surface/85 text-ink shadow-md backdrop-blur active:scale-95 active:bg-bordeaux-soft"
            aria-label={t('notFound.game.duck')}
          >
            <ChevronsDown className="size-6" aria-hidden />
          </button>
        )}
      </div>

      <p id={instructions} className="sr-only">
        {t('notFound.game.instructions')}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {confetti && <ConfettiBurst onDone={() => setConfetti(false)} />}
    </div>
  )
}
