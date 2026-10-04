/**
 * Magilla's escape: the 404 mini game. Pure state and physics, no DOM.
 * World units: the stage is always 240 high, its width follows the container.
 * x grows to the right, y grows down, the street is at y = GROUND.
 */

export const WORLD_H = 240
export const GROUND = 204
export const WINDOW_FLOOR = 184
export const PLAYER_X = 104

const GRAVITY = 2600
const JUMP_V = 690
const JUMP_CUT_V = 590
const FAST_FALL = 2.8
const BUFFER_S = 0.12
const START_SPEED = 330
const MAX_SPEED = 760
const ACCEL = 8
const UNITS_PER_POINT = 40
export const BANANA_POINTS = 10

export type ObstacleKind = 'hydrant' | 'can' | 'crates' | 'stack' | 'pigeon'
export type Obstacle = { id: number; kind: ObstacleKind; x: number; y: number; w: number; h: number }
export type Banana = { id: number; x: number; y: number; taken: boolean }
export type Phase = 'idle' | 'running' | 'paused' | 'over'
export type Box = { l: number; t: number; r: number; b: number }

export type GameEvent =
  | { type: 'start' }
  | { type: 'jump' }
  | { type: 'land'; hard: boolean }
  | { type: 'banana'; x: number; y: number }
  | { type: 'milestone'; score: number }
  | { type: 'crash'; obstacle: Obstacle }

export type Game = {
  phase: Phase
  /** The very first run starts in the shop window; restarts begin on the street. */
  fromWindow: boolean
  time: number
  runTime: number
  speed: number
  scroll: number
  distance: number
  bonus: number
  bananas: number
  best: number
  nextSpawn: number
  nextId: number
  obstacles: Obstacle[]
  items: Banana[]
  player: {
    y: number
    vy: number
    floor: number
    airborne: boolean
    ducking: boolean
    jumpHeld: boolean
    duckHeld: boolean
    buffered: number
  }
  events: GameEvent[]
}

const SIZES: Record<ObstacleKind, { w: number; h: number }> = {
  hydrant: { w: 22, h: 30 },
  can: { w: 26, h: 40 },
  crates: { w: 48, h: 30 },
  stack: { w: 30, h: 52 },
  pigeon: { w: 30, h: 16 },
}

/** Pigeon heights above the street: low (jump it), middle (duck), high (just keep running). */
const PIGEON_LIFT = [14, 60, 92]

export function createGame(best = 0): Game {
  return {
    phase: 'idle',
    fromWindow: true,
    time: 0,
    runTime: 0,
    speed: START_SPEED,
    scroll: 0,
    distance: 0,
    bonus: 0,
    bananas: 0,
    best,
    nextSpawn: 0,
    nextId: 1,
    obstacles: [],
    items: [],
    player: {
      y: WINDOW_FLOOR,
      vy: 0,
      floor: WINDOW_FLOOR,
      airborne: false,
      ducking: false,
      jumpHeld: false,
      duckHeld: false,
      buffered: 0,
    },
    events: [],
  }
}

export function score(game: Game) {
  return Math.floor(game.distance / UNITS_PER_POINT) + game.bonus
}

export function start(game: Game, width: number) {
  const restart = game.phase === 'over'
  if (restart) {
    const best = Math.max(game.best, score(game))
    Object.assign(game, createGame(best), { fromWindow: false })
    game.player.y = GROUND
    game.player.floor = GROUND
  }
  game.phase = 'running'
  game.runTime = 0
  game.nextSpawn = game.scroll + width + (restart ? 160 : 260)
  const p = game.player
  p.floor = GROUND
  if (!restart) {
    // Hop out of the window.
    p.vy = -520
    p.airborne = true
  }
  game.events.push({ type: 'start' })
}

export function setPaused(game: Game, paused: boolean) {
  if (paused && game.phase === 'running') game.phase = 'paused'
  else if (!paused && game.phase === 'paused') game.phase = 'running'
}

export function jumpDown(game: Game, width: number) {
  const p = game.player
  if (game.phase === 'idle' || game.phase === 'over') return start(game, width)
  if (game.phase === 'paused') return setPaused(game, false)
  p.jumpHeld = true
  if (!p.airborne) jump(game)
  else p.buffered = BUFFER_S
}

export function jumpUp(game: Game) {
  const p = game.player
  p.jumpHeld = false
  if (p.airborne && p.vy < -JUMP_CUT_V) p.vy = -JUMP_CUT_V
}

export function duck(game: Game, held: boolean) {
  game.player.duckHeld = held
  if (!held) game.player.ducking = false
}

function jump(game: Game) {
  const p = game.player
  p.vy = -JUMP_V
  p.airborne = true
  p.ducking = false
  p.buffered = 0
  game.events.push({ type: 'jump' })
}

/** Collision boxes for Magilla, slightly forgiving. */
export function playerBoxes(game: Game): Box[] {
  const { y, ducking } = game.player
  const x = PLAYER_X
  if (ducking) return [{ l: x - 16, t: y - 46, r: x + 26, b: y - 3 }]
  return [
    { l: x - 14, t: y - 56, r: x + 16, b: y - 3 },
    { l: x - 2, t: y - 76, r: x + 20, b: y - 54 },
  ]
}

export function obstacleBoxes(o: Obstacle): Box[] {
  const { x, y, w, h } = o
  switch (o.kind) {
    case 'hydrant':
      return [
        { l: x + 4, t: y - h + 2, r: x + w - 4, b: y },
        { l: x, t: y - h + 9, r: x + w, b: y - h + 16 },
      ]
    case 'pigeon':
      return [{ l: x + 3, t: y - h + 3, r: x + w - 3, b: y - 2 }]
    default:
      return [{ l: x + 2, t: y - h + 2, r: x + w - 2, b: y }]
  }
}

const hits = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!

function spawn(game: Game) {
  const s = score(game)
  const x = game.nextSpawn
  let kind: ObstacleKind
  const roll = Math.random()
  if (s > 120 && roll < 0.24) kind = 'pigeon'
  else if (s > 60 && roll < 0.38) kind = 'stack'
  else kind = pick(s > 30 ? (['hydrant', 'can', 'crates'] as const) : (['hydrant', 'can'] as const))

  const { w, h } = SIZES[kind]
  const lift = kind === 'pigeon' ? pick(s > 260 ? PIGEON_LIFT : PIGEON_LIFT.slice(0, 2)) : 0
  const obstacle: Obstacle = { id: game.nextId++, kind, x, y: GROUND - lift, w, h }
  game.obstacles.push(obstacle)

  const gapMin = game.speed * 0.72 + 150
  const gapMax = game.speed * 1.1 + 280
  const gap = gapMin + Math.random() * (gapMax - gapMin)

  // Bananas: an arc over a ground obstacle (the jump line), or a short row on the street.
  if (Math.random() < 0.55) {
    const center = x + w / 2
    if (kind !== 'pigeon' && Math.random() < 0.6) {
      const half = game.speed * (JUMP_V / GRAVITY)
      for (const k of [-0.62, 0, 0.62]) {
        const rise = (JUMP_V * JUMP_V) / (2 * GRAVITY) * (1 - k * k)
        game.items.push({ id: game.nextId++, x: center + k * half, y: GROUND - rise - 40, taken: false })
      }
    } else if (kind !== 'pigeon' || lift > 20) {
      const row = center + gap * 0.5
      for (const k of [-1, 0, 1]) {
        game.items.push({ id: game.nextId++, x: row + k * 30, y: GROUND - 30, taken: false })
      }
    }
  }
  game.nextSpawn = x + w + gap
}

export function step(game: Game, dt: number, width: number) {
  game.time += dt
  if (game.phase !== 'running') return
  game.runTime += dt
  const p = game.player

  const before = score(game)
  game.speed = Math.min(MAX_SPEED, START_SPEED + game.runTime * ACCEL)
  const dx = game.speed * dt
  game.scroll += dx
  game.distance += dx

  // Magilla
  p.buffered = Math.max(0, p.buffered - dt)
  if (p.airborne) {
    const fast = p.duckHeld ? FAST_FALL : 1
    p.vy += GRAVITY * fast * dt
    p.y += p.vy * dt
    if (p.y >= p.floor) {
      const hard = p.vy > 820
      p.y = p.floor
      p.vy = 0
      p.airborne = false
      game.events.push({ type: 'land', hard })
      if (p.buffered > 0) jump(game)
    }
  }
  p.ducking = !p.airborne && p.duckHeld

  // World
  while (game.nextSpawn < game.scroll + width + 80) spawn(game)
  const left = game.scroll - 120
  game.obstacles = game.obstacles.filter((o) => o.x + o.w > left)
  game.items = game.items.filter((b) => b.x > left && !b.taken)

  // Pigeons fly toward you a little faster than the street moves.
  for (const o of game.obstacles) if (o.kind === 'pigeon') o.x -= 70 * dt

  const me = playerBoxes(game).map((b) => ({ ...b, l: b.l + game.scroll, r: b.r + game.scroll }))
  for (const b of game.items) {
    const box = { l: b.x - 8, t: b.y - 9, r: b.x + 8, b: b.y + 9 }
    if (me.some((m) => hits(m, box))) {
      b.taken = true
      game.bananas += 1
      game.bonus += BANANA_POINTS
      game.events.push({ type: 'banana', x: b.x - game.scroll, y: b.y })
    }
  }
  for (const o of game.obstacles) {
    if (obstacleBoxes(o).some((ob) => me.some((m) => hits(m, ob)))) {
      game.phase = 'over'
      game.best = Math.max(game.best, score(game))
      game.events.push({ type: 'crash', obstacle: o })
      return
    }
  }

  const after = score(game)
  if (Math.floor(after / 100) > Math.floor(before / 100)) {
    game.events.push({ type: 'milestone', score: Math.floor(after / 100) * 100 })
  }
}
