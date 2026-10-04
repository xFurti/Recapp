import { GROUND, PLAYER_X, type Game } from '../../lib/magilla-game'
import { restPose, type Pose } from './rig'

/** Everything about Magilla's acting that the game rules don't care about. */
export type Acting = {
  cycle: number
  stepped: boolean
  blinkAt: number
  gestureAt: number
  gesture: 'tip' | 'wave' | 'thump' | null
  gestureStart: number
  hatY: number
  hatV: number
  lastVy: number
  squash: number
  chompUntil: number
  crashAt: number
  look: [number, number]
  lookTarget: [number, number] | null
}

export function createActing(): Acting {
  return {
    cycle: 0,
    stepped: false,
    blinkAt: 1.6,
    gestureAt: 2.2,
    gesture: null,
    gestureStart: 0,
    hatY: 0,
    hatV: 0,
    lastVy: 0,
    squash: 0,
    chompUntil: 0,
    crashAt: 0,
    look: [0.6, 0],
    lookTarget: null,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (lo: number, hi: number, v: number) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1)
  return t * t * (3 - 2 * t)
}
const mixLimb = (a: [number, number], b: [number, number], t: number): [number, number] => [mix(a[0], b[0], t), mix(a[1], b[1], t)]

export function landed(acting: Acting, hard: boolean) {
  acting.squash = hard ? 0.24 : 0.15
}
export function tookOff(acting: Acting) {
  acting.squash = -0.12
}
export function chomp(acting: Acting, time: number) {
  acting.chompUntil = time + 0.34
}
export function crashed(acting: Acting, time: number) {
  acting.crashAt = time
}

export function act(game: Game, a: Acting, dt: number, calm: boolean): Pose {
  const t = game.time
  const p = game.player
  const pose = restPose()
  pose.x = PLAYER_X
  pose.y = p.y
  a.stepped = false
  const frozen = game.phase === 'paused'

  // Blink every few seconds; a double blink now and then.
  if (t > a.blinkAt + 0.16) a.blinkAt = t + 2.2 + Math.random() * 3.4
  const sinceBlink = t - a.blinkAt
  pose.blink = sinceBlink >= 0 && sinceBlink < 0.16 ? 1 - Math.abs(sinceBlink - 0.08) / 0.08 : 0

  // Eyes follow the pointer while he waits in the window.
  const target = a.lookTarget ?? [0.6, 0]
  a.look[0] = mix(a.look[0], target[0], Math.min(1, dt * 10))
  a.look[1] = mix(a.look[1], target[1], Math.min(1, dt * 10))
  pose.look = [a.look[0], a.look[1]]

  if (game.phase === 'over') return knockedOut(game, a, pose)

  if (game.phase === 'idle') {
    pose.breath = 1 + Math.sin(t * 2.2) * 0.018
    pose.head = Math.sin(t * 1.1) * 2
    if (!calm) idleGesture(a, t, pose)
  } else if (p.airborne) {
    // Superman leap on the way up; on the way down the arms windmill and the legs reach for the street.
    const fall = smooth(-260, 320, p.vy)
    const flap = Math.sin(t * 24) * 16 * fall
    pose.armF = mixLimb([-78, -40], [-46 + flap, -34], fall)
    pose.armB = mixLimb([128, 18], [112 - flap, -30], fall)
    pose.legF = mixLimb([-84, 112], [-30, 34], fall)
    pose.legB = mixLimb([-46, 96], [10, 40], fall)
    pose.lean = mix(6, 2, fall)
    pose.head = mix(-10, 2, fall)
    pose.mouth = 'open'
  } else {
    const rate = Math.PI * 2 * (1.2 + game.speed / 240)
    const before = Math.sin(a.cycle)
    if (!frozen) a.cycle += dt * rate
    const s = Math.sin(a.cycle)
    const c = Math.cos(a.cycle)
    if (Math.sign(before) !== Math.sign(s)) a.stepped = true

    if (p.ducking) {
      // Down on all fours, the way a gorilla really runs. Hat stays on.
      const lean = 64
      pose.lean = lean
      pose.y += 5.5
      pose.bob = -Math.abs(c) * 1.6
      pose.legF = [-48 + s * 16, 84 + Math.max(0, c) * 20]
      pose.legB = [-40 - s * 16, 80 + Math.max(0, -c) * 20]
      pose.armF = [-18 - s * 26 - lean, -8 - Math.max(0, -c) * 30]
      pose.armB = [-24 + s * 26 - lean, -8 - Math.max(0, c) * 30]
      pose.head = -54 + Math.sin(a.cycle * 2) * 2
    } else {
      pose.lean = 9
      pose.bob = -Math.abs(c) * 2.6
      pose.legF = [-38 * s, 12 + 64 * Math.max(0, c)]
      pose.legB = [38 * s, 12 + 64 * Math.max(0, -c)]
      pose.armF = [34 * s, -62 - 10 * s]
      pose.armB = [-34 * s, -62 + 10 * s]
      pose.head = -5 + Math.sin(a.cycle * 2) * 2
    }
    // Eyes on the road.
    pose.look = [1, 0.3]
  }

  if (t < a.chompUntil) pose.mouth = Math.floor((a.chompUntil - t) / 0.085) % 2 === 0 ? 'chomp' : 'grin'

  // Squash and stretch, anchored at the feet.
  if (!frozen) a.squash = mix(a.squash, 0, Math.min(1, dt * 12))
  pose.sx = 1 + a.squash * 0.55
  pose.sy = 1 - a.squash

  // The undersized derby rides on a spring: it floats when he falls and pops on landing.
  if (!frozen && dt > 0) {
    const accel = (p.vy - a.lastVy) / dt
    a.lastVy = p.vy
    const k = 520
    const damp = 15
    a.hatV += (-k * a.hatY - damp * a.hatV - clamp(accel, -60000, 60000) * 0.9) * dt
    a.hatV = clamp(a.hatV, -260, 260)
    a.hatY = clamp(a.hatY + a.hatV * dt, -10, 1.6)
    if (a.hatY === 1.6 && a.hatV > 0) a.hatV *= -0.4
  }
  pose.hatY += a.hatY + pose.bob * -0.25
  pose.hatRot += a.hatY * 2.2 + (game.phase === 'running' && !p.airborne ? Math.sin(a.cycle * 2) * 2 : 0)
  return pose
}

function idleGesture(a: Acting, t: number, pose: Pose) {
  if (!a.gesture && t >= a.gestureAt) {
    const roll = Math.random()
    a.gesture = roll < 0.4 ? 'tip' : roll < 0.75 ? 'wave' : 'thump'
    a.gestureStart = t
  }
  if (!a.gesture) return
  const dur = { tip: 1.7, wave: 2.1, thump: 1.6 }[a.gesture]
  const u = (t - a.gestureStart) / dur
  if (u >= 1) {
    a.gesture = null
    a.gestureAt = t + 3.5 + Math.random() * 4
    return
  }
  const env = smooth(0, 0.22, u) * (1 - smooth(0.78, 1, u))
  if (a.gesture === 'tip') {
    // Reach up behind the ear to the brim, lift, little nod, put it back.
    const lift = smooth(0.25, 0.42, u) * (1 - smooth(0.62, 0.78, u))
    pose.armF = mixLimb(pose.armF, [156 + lift * 4, -18 - lift * 8], env)
    pose.hatY -= lift * 6.5
    pose.hatX -= lift * 1.5
    pose.hatRot += lift * 14
    pose.head += lift * 8
    pose.lean += lift * 2
  } else if (a.gesture === 'wave') {
    const wag = Math.sin((t - a.gestureStart) * 15) * 24
    pose.armB = mixLimb(pose.armB, [166, 14 + wag], env)
    pose.head -= env * 4
    pose.lean -= env * 2
  } else {
    // A proud gorilla chest thump.
    const beat = Math.abs(Math.sin((t - a.gestureStart) * 16))
    pose.armF = mixLimb(pose.armF, [-24 + beat * 10, -112 + beat * 18], env)
    pose.head -= env * 9
    pose.lean -= env * 4
    pose.mouth = env > 0.3 ? (beat > 0.5 ? 'open' : 'grin') : pose.mouth
    pose.breath += env * 0.04
  }
}

function knockedOut(game: Game, a: Acting, pose: Pose): Pose {
  const t = game.time - a.crashAt
  const hit = smooth(0, 0.16, t)
  const sit = smooth(0.14, 0.42, t)
  pose.hatOff = true
  pose.feet = 0.25 * (1 - sit)
  pose.x -= 10 * hit
  pose.y = Math.min(game.player.y, GROUND) - Math.sin(clamp(t / 0.42, 0, 1) * Math.PI) * 16 + 15 * sit
  pose.lean = mix(-26, -10 + Math.sin(game.time * 5) * 3, sit)
  pose.legF = mixLimb([-50, 60], [-84, 2], sit)
  pose.legB = mixLimb([-30, 50], [-76, 6], sit)
  pose.armF = mixLimb([-150, -30], [6 + Math.sin(game.time * 5) * 4, -34], sit)
  pose.armB = mixLimb([-120, -20], [34, -26], sit)
  pose.head = mix(-12, Math.sin(game.time * 5) * 7, sit)
  pose.mouth = sit > 0.5 ? 'worried' : 'open'
  pose.dizzy = smooth(0.3, 0.6, t)
  pose.blink = 0
  pose.look = [0, 0]
  a.squash = 0
  a.hatY = 0
  a.hatV = 0
  return pose
}
