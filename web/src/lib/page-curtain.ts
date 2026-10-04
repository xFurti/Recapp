// An original clip wipe in the spirit of Motion's Curtains `clipWipe`: a still panel whose clip-path
// sweeps over the old page, then sweeps on to reveal the new one. Driven per frame so a navigation in
// the middle of a wipe can retarget it from wherever it is, instead of queuing another one.

export const COVER_MS = 280
export const REVEAL_MS = 420

/** How far the middle of the edge runs ahead of its ends, as a share of the travel. */
const BOW = 0.1
/** Width of the bordeaux edge that leads the cover and trails the reveal, in pixels. */
const EDGE_PX = 6
const SEGMENTS = 12

export type Axis = 'x' | 'y'
export type Direction = 1 | -1

export type CurtainParts = {
  layer: HTMLElement
  old: HTMLElement
  panel: HTMLElement
  edge: HTMLElement
}

type Bounds = { top: number; bottom: number }

const easeIn = (t: number) => t * t
const easeOut = (t: number) => 1 - (1 - t) ** 3
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** A still, unreachable copy of the page as it was, drawn exactly where it was. */
function freeze(main: HTMLElement) {
  const rect = main.getBoundingClientRect()
  // A plain block, not a second <main>: the page keeps one main landmark.
  const copy = document.createElement('div')
  copy.className = main.className
  copy.append(...Array.from(main.childNodes, (node) => node.cloneNode(true)))
  // Typed values live on the elements, not in the markup.
  const live = main.querySelectorAll<HTMLInputElement>('input, textarea, select')
  copy.querySelectorAll<HTMLInputElement>('input, textarea, select').forEach((field, index) => {
    field.value = live[index]?.value ?? field.value
    field.checked = live[index]?.checked ?? field.checked
  })
  for (const element of [copy, ...copy.querySelectorAll('[id], [data-tour], [tabindex]')]) {
    element.removeAttribute('id')
    element.removeAttribute('data-tour')
    element.removeAttribute('tabindex')
  }
  copy.inert = true
  copy.classList.add('page-curtain-frozen')
  Object.assign(copy.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, margin: '0' })
  return copy
}

/**
 * The covered band runs from the tail edge to the lead edge along the travel axis (u), across the
 * whole page (v). Both edges bow forward; the tail never passes the lead.
 */
function polygon(lead: number, tail: number, axis: Axis, dir: Direction) {
  const bulge = (v: number) => BOW * (1 - (2 * v - 1) ** 2)
  const point = (u: number, v: number) => {
    const along = dir === 1 ? u : 1 - u
    const [x, y] = axis === 'x' ? [along, v] : [v, along]
    return `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`
  }
  const front: string[] = []
  const back: string[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const v = i / SEGMENTS
    const u = lead + bulge(v)
    front.push(point(u, v))
    back.unshift(point(Math.min(u, tail + bulge(v)), v))
  }
  return `polygon(${[...front, ...back].join(', ')})`
}

export class PageCurtain {
  private parts: CurtainParts
  private main: HTMLElement | null = null
  private frame = 0
  /** Cover progress (the lead edge) and reveal progress (the tail edge), both 0..1. */
  private lead = 0
  private tail = 0
  private axis: Axis = 'x'
  private dir: Direction = 1
  private next: { axis: Axis; dir: Direction } = { axis: 'x', dir: 1 }
  private phase: 'idle' | 'cover' | 'reveal' = 'idle'
  private bounds: () => Bounds
  private onCovered: () => void

  constructor(parts: CurtainParts, bounds: () => Bounds, onCovered: () => void) {
    this.parts = parts
    this.bounds = bounds
    this.onCovered = onCovered
  }

  get running() {
    return this.phase !== 'idle'
  }

  /**
   * Called just before React swaps the page. The first request freezes what is on screen and starts
   * covering it; later ones only change where the reveal goes. During a reveal, the edge turns back.
   */
  cover(main: HTMLElement, axis: Axis, dir: Direction) {
    this.main = main
    this.next = { axis, dir }
    if (this.phase === 'cover') return
    const { layer, old, panel, edge } = this.parts
    if (this.phase === 'idle') {
      this.axis = axis
      this.dir = dir
      this.lead = 0
      this.tail = 0
      const { top, bottom } = this.bounds()
      for (const part of [panel, edge]) Object.assign(part.style, { top: `${top}px`, bottom: `${bottom}px` })
    }
    old.replaceChildren(freeze(main))
    old.hidden = false
    layer.hidden = false
    main.inert = true
    this.phase = 'cover'
    this.draw()
    this.run()
  }

  /** Removes the curtain at once, wherever it is: unmounts, reduced motion and errors. */
  stop() {
    cancelAnimationFrame(this.frame)
    this.phase = 'idle'
    this.lead = 0
    this.tail = 0
    this.parts.old.replaceChildren()
    this.parts.old.hidden = true
    this.parts.layer.hidden = true
    if (this.main) this.main.inert = false
  }

  private run() {
    cancelAnimationFrame(this.frame)
    // Covering again from a reveal retraces the tail; a fresh cover advances the lead.
    const retreat = this.phase === 'cover' && this.tail > 0
    const from = retreat ? this.tail : this.lead
    const ms = this.phase === 'reveal' ? REVEAL_MS : Math.max(1, (retreat ? from : 1 - from) * COVER_MS)
    const start = performance.now()
    const tick = (now: number) => {
      try {
        const t = Math.min(1, (now - start) / ms)
        if (this.phase === 'cover') {
          if (retreat) this.tail = lerp(from, 0, easeOut(t))
          else this.lead = lerp(from, 1, easeIn(t))
        } else {
          this.tail = easeOut(t)
        }
        this.draw()
        if (t < 1) {
          this.frame = requestAnimationFrame(tick)
          return
        }
        if (this.phase === 'cover') this.covered()
        else this.stop()
      } catch (error) {
        this.stop()
        throw error
      }
    }
    this.frame = requestAnimationFrame(tick)
  }

  /** Fully covered: show the destination underneath and start revealing it. */
  private covered() {
    this.lead = 1
    this.tail = 0
    this.parts.old.replaceChildren()
    this.parts.old.hidden = true
    if (this.main) this.main.inert = false
    ;({ axis: this.axis, dir: this.dir } = this.next)
    this.phase = 'reveal'
    this.draw()
    this.run()
    this.onCovered()
  }

  private draw() {
    const { panel, edge } = this.parts
    const size = this.axis === 'x' ? panel.clientWidth : panel.clientHeight
    const width = size ? EDGE_PX / size : 0
    // Lead runs from just before the start to the far side; tail from the start to just past it.
    const lead = lerp(-BOW - width, 1, this.lead)
    const tail = lerp(-BOW, 1 + width, this.tail)
    panel.style.clipPath = polygon(lead, tail, this.axis, this.dir)
    edge.style.clipPath = polygon(lead + width, tail - width, this.axis, this.dir)
  }
}
