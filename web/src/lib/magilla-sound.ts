/** Tiny synthesized sound effects for the 404 game. Nothing to download; silent until the first tap. */

const KEY = 'recapp.magilla.sound'

let ctx: AudioContext | null = null

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode */
  }
}

function audio() {
  if (!soundOn()) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(from: number, to: number, ms: number, type: OscillatorType, volume: number, delayMs = 0) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + delayMs / 1000
  const end = t + ms / 1000
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, end)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(end + 0.02)
}

function thud(ms: number, volume: number) {
  const a = audio()
  if (!a) return
  const length = Math.floor((a.sampleRate * ms) / 1000)
  const buffer = a.createBuffer(1, length, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
  const src = a.createBufferSource()
  const filter = a.createBiquadFilter()
  const gain = a.createGain()
  src.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.value = 900
  gain.gain.value = volume
  src.connect(filter).connect(gain).connect(a.destination)
  src.start()
}

/** Call from a user gesture so iOS unlocks audio. */
export function unlockSound() {
  audio()
}

export const sfx = {
  jump: () => tone(260, 620, 140, 'square', 0.035),
  land: () => thud(60, 0.25),
  banana: () => {
    tone(988, 988, 60, 'triangle', 0.09)
    tone(1480, 1480, 110, 'triangle', 0.08, 60)
  },
  milestone: () => {
    tone(1047, 1047, 90, 'square', 0.03)
    tone(1568, 1568, 160, 'square', 0.03, 100)
  },
  crash: () => {
    thud(180, 0.6)
    tone(330, 70, 420, 'sawtooth', 0.05)
    tone(1200, 900, 90, 'triangle', 0.05, 380)
    tone(1200, 900, 90, 'triangle', 0.05, 520)
  },
  start: () => {
    tone(523, 523, 70, 'square', 0.03)
    tone(659, 659, 70, 'square', 0.03, 80)
    tone(784, 784, 120, 'square', 0.03, 160)
  },
}
