/** Original side-on runner. The gorilla is drawn here: lilac fur, pale muzzle, small green bowler, bow tie. */

export const GROUND = 214
const GRAVITY = 1650
const JUMP_V = -414
const HIT_W = 52
const HIT_H = 78

export type Phase = 'idle' | 'run' | 'over'
export type ObstacleKind = 'crate' | 'vase' | 'sign' | 'broom'

export type Obstacle = { kind: ObstacleKind; x: number; w: number; h: number }

export type Runner = {
  phase: Phase
  y: number
  vy: number
  speed: number
  distance: number
  score: number
  best: number
  obstacles: Obstacle[]
  spawnIn: number
  leg: number
  reduced: boolean
}

export type Palette = {
  paper: string
  surface: string
  ink: string
  muted: string
  bordeaux: string
  line: string
}

const KINDS: { kind: ObstacleKind; w: number; h: number }[] = [
  { kind: 'crate', w: 30, h: 30 },
  { kind: 'vase', w: 26, h: 38 },
  { kind: 'sign', w: 32, h: 48 },
  { kind: 'broom', w: 24, h: 44 },
]

export const magillaX = 118

export function createRunner(best: number, reduced: boolean): Runner {
  return {
    phase: 'idle',
    y: GROUND,
    vy: 0,
    speed: 230,
    distance: 0,
    score: 0,
    best,
    obstacles: [],
    spawnIn: 380,
    leg: 0,
    reduced,
  }
}

/** Starts a waiting or finished run, and jumps when the feet are on the ground. */
export function jump(runner: Runner) {
  if (runner.phase !== 'run') {
    const best = runner.best
    const reduced = runner.reduced
    Object.assign(runner, createRunner(best, reduced))
    runner.phase = 'run'
  }
  if (runner.y >= GROUND - 0.6 && runner.vy >= 0) runner.vy = JUMP_V
}

export function step(runner: Runner, dt: number, viewW: number) {
  if (runner.phase !== 'run') return
  const stepDt = Math.min(dt, 0.032)
  runner.vy += GRAVITY * stepDt
  runner.y += runner.vy * stepDt
  if (runner.y >= GROUND) {
    runner.y = GROUND
    runner.vy = 0
  }
  runner.distance += runner.speed * stepDt
  runner.leg += stepDt * 11
  runner.score = Math.floor(runner.distance / 28)
  runner.speed = Math.min(430, 230 + runner.score * 0.85)

  for (const obstacle of runner.obstacles) obstacle.x -= runner.speed * stepDt
  runner.obstacles = runner.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -8)

  runner.spawnIn -= runner.speed * stepDt
  if (runner.spawnIn <= 0) {
    const spec = KINDS[Math.floor(Math.random() * KINDS.length)]
    runner.obstacles.push({ kind: spec.kind, x: viewW + 6, w: spec.w, h: spec.h })
    const gap = 300 + Math.random() * 170 - Math.min(runner.score, 36)
    runner.spawnIn = Math.max(270, gap)
  }

  const body = { x: magillaX - HIT_W / 2, y: runner.y - HIT_H, w: HIT_W, h: HIT_H }
  for (const obstacle of runner.obstacles) {
    const box = {
      x: obstacle.x + 5,
      y: GROUND - obstacle.h + 2,
      w: obstacle.w - 8,
      h: obstacle.h - 4,
    }
    if (overlaps(body, box)) {
      runner.phase = 'over'
      if (runner.score > runner.best) runner.best = runner.score
      return
    }
  }
}

export function draw(ctx: CanvasRenderingContext2D, runner: Runner, colors: Palette, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = colors.paper
  ctx.fillRect(0, 0, width, height)
  drawShop(ctx, runner.distance, colors, width)
  drawGround(ctx, runner.distance, colors, width, height)
  for (const obstacle of runner.obstacles) drawObstacle(ctx, obstacle, colors)
  const airborne = runner.y < GROUND - 0.6
  drawMagilla(ctx, magillaX, runner.y, runner.reduced ? 0 : runner.leg, airborne, colors.ink)
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function drawShop(ctx: CanvasRenderingContext2D, distance: number, colors: Palette, width: number) {
  const shift = (distance * 0.18) % 200
  ctx.save()
  ctx.strokeStyle = colors.line
  ctx.lineWidth = 2
  ctx.fillStyle = colors.bordeaux
  for (let x = -shift; x < width + 200; x += 200) {
    ctx.globalAlpha = 0.9
    ctx.strokeRect(x + 16, 28, 156, GROUND - 40)
    ctx.globalAlpha = 0.55
    ctx.fillRect(x + 16, 18, 156, 12)
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(x + 94, 30)
    ctx.lineTo(x + 94, GROUND - 12)
    ctx.stroke()
  }
  ctx.restore()
}

function drawGround(ctx: CanvasRenderingContext2D, distance: number, colors: Palette, width: number, height: number) {
  ctx.fillStyle = colors.surface
  ctx.fillRect(0, GROUND, width, height - GROUND)
  ctx.strokeStyle = colors.ink
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, GROUND + 0.5)
  ctx.lineTo(width, GROUND + 0.5)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.strokeStyle = colors.line
  ctx.lineWidth = 1
  const floor = (distance * 0.85) % 26
  for (let x = -floor; x < width + 26; x += 26) {
    ctx.beginPath()
    ctx.moveTo(x, GROUND)
    ctx.lineTo(x - 14, height)
    ctx.stroke()
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, colors: Palette) {
  const { x, w, h, kind } = obstacle
  const y = GROUND - h
  ctx.save()
  ctx.lineWidth = 2
  ctx.strokeStyle = colors.ink
  ctx.lineJoin = 'round'
  if (kind === 'crate') {
    roundRect(ctx, x, y, w, h, 4)
    ctx.fillStyle = colors.surface
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = colors.bordeaux
    ctx.beginPath()
    ctx.moveTo(x + 6, y + 6)
    ctx.lineTo(x + w - 6, y + h - 6)
    ctx.moveTo(x + w - 6, y + 6)
    ctx.lineTo(x + 6, y + h - 6)
    ctx.stroke()
  } else if (kind === 'vase') {
    ctx.fillStyle = colors.surface
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + 8, 6, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w / 2 - 5, y + 12)
    ctx.lineTo(x + 3, y + h - 6)
    ctx.quadraticCurveTo(x + w / 2, y + h + 4, x + w - 3, y + h - 6)
    ctx.lineTo(x + w / 2 + 5, y + 12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = colors.bordeaux
    ctx.fillRect(x + 4, y + h * 0.48, w - 8, 5)
  } else if (kind === 'sign') {
    ctx.fillStyle = colors.ink
    ctx.fillRect(x + w / 2 - 2, y + 16, 4, h - 16)
    roundRect(ctx, x, y, w, 18, 3)
    ctx.fillStyle = colors.bordeaux
    ctx.fill()
    ctx.fillStyle = colors.paper
    ctx.globalAlpha = 0.85
    ctx.fillRect(x + 6, y + 7, w - 12, 3)
    ctx.globalAlpha = 1
  } else {
    ctx.strokeStyle = colors.ink
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + w / 2, y)
    ctx.lineTo(x + w / 2, y + h - 10)
    ctx.stroke()
    ctx.fillStyle = colors.bordeaux
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h - 8, w / 2, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawMagilla(ctx: CanvasRenderingContext2D, cx: number, feet: number, leg: number, air: boolean, ink: string) {
  const swing = air ? 0.7 : Math.sin(leg)
  const fur = '#8b70b6'
  const furDark = '#5c457f'
  const skin = '#f6ecdf'
  const hat = '#2c9442'
  const hatDark = '#1c6a2e'
  const bow = '#e23b66'

  ctx.save()
  ctx.translate(cx, feet)

  ctx.fillStyle = ink
  ctx.globalAlpha = 0.12
  ctx.beginPath()
  ctx.ellipse(8, 3, air ? 18 : 30, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  drawLeg(ctx, -2, swing * 0.8, furDark, skin)
  drawLeg(ctx, 18, -swing * 0.8, fur, skin)

  ctx.fillStyle = fur
  ctx.beginPath()
  ctx.ellipse(10, -62, 36, 28, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(22, -58, 12, 14, 0.2, 0, Math.PI * 2)
  ctx.fill()

  // Back arm, then the long front arm with a big pale hand.
  ctx.save()
  ctx.translate(0, -72)
  ctx.rotate(swing * 0.5)
  ctx.fillStyle = furDark
  ctx.beginPath()
  ctx.ellipse(-4, 16, 8, 16, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(34, -68)
  ctx.rotate(air ? -1.05 : -swing)
  ctx.fillStyle = fur
  ctx.beginPath()
  ctx.ellipse(2, 22, 8, 22, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(6, 42, 9, 6, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = furDark
  ctx.beginPath()
  ctx.ellipse(-8, -104, 11, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0c4be'
  ctx.beginPath()
  ctx.ellipse(-8, -104, 6, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = fur
  ctx.beginPath()
  ctx.ellipse(14, -108, 28, 26, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = furDark
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(2, -124)
  ctx.quadraticCurveTo(14, -132, 28, -122)
  ctx.stroke()

  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(30, -100, 15, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3a2a30'
  ctx.beginPath()
  ctx.ellipse(36, -104, 9, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(42, -103, 2, 1.2, 0, 0, Math.PI * 2)
  ctx.ellipse(47, -103, 2, 1.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(18, -114, 6.5, 6.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1c1a1d'
  ctx.beginPath()
  ctx.arc(20, -114, 2.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(19.1, -115, 1, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#6d463f'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(32, -96, 8, 0.25, Math.PI - 0.15)
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(12, -82, 11, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = bow
  ctx.beginPath()
  ctx.moveTo(10, -82)
  ctx.lineTo(-14, -94)
  ctx.lineTo(-14, -70)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(16, -82)
  ctx.lineTo(38, -96)
  ctx.lineTo(38, -68)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#9a2048'
  ctx.beginPath()
  ctx.arc(13, -82, 5, 0, Math.PI * 2)
  ctx.fill()

  // Small bowler, perched on the big head.
  ctx.fillStyle = hat
  ctx.beginPath()
  ctx.ellipse(12, -132, 18, 5, -0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(12, -142, 10, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hatDark
  ctx.fillRect(2, -138, 20, 4)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(8, -145, 3.5, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawLeg(ctx: CanvasRenderingContext2D, x: number, swing: number, fur: string, skin: string) {
  ctx.save()
  ctx.translate(x, -2)
  ctx.rotate(swing * 0.45)
  ctx.fillStyle = fur
  ctx.beginPath()
  ctx.ellipse(0, -14, 10, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(8, 0, 11, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
