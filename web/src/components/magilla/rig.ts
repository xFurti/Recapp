/** Magilla's colors, his pose shape and the code that moves the joints of <MagillaSprite>. */

export const C = {
  ink: '#1d1b1e',
  fur: '#5f5b6b',
  furBack: '#4a4655',
  skin: '#f4caa2',
  skinBack: '#dfae82',
  mouth: '#6e1f2b',
  tongue: '#e4707e',
  hat: '#8650c2',
  hatBand: '#56308c',
  shorts: '#d9392f',
  strap: '#3d9b3a',
  button: '#f4d35e',
  shoe: '#7a4824',
  shoeBack: '#5e3619',
  star: '#f8c828',
}

export type Mouth = 'grin' | 'open' | 'chomp' | 'worried'
type Limb = [number, number]

export type Pose = {
  x: number
  y: number
  sx: number
  sy: number
  lean: number
  bob: number
  breath: number
  head: number
  hatX: number
  hatY: number
  hatRot: number
  hatOff: boolean
  armF: Limb
  armB: Limb
  legF: Limb
  legB: Limb
  /** How much the shoes stay level with the street (0 = follow the shin). */
  feet: number
  look: [number, number]
  blink: number
  mouth: Mouth
  dizzy: number
}

export const restPose = (): Pose => ({
  x: 0,
  y: 0,
  sx: 1,
  sy: 1,
  lean: 0,
  bob: 0,
  breath: 1,
  head: 0,
  hatX: 0,
  hatY: 0,
  hatRot: 0,
  hatOff: false,
  armF: [-8, -14],
  armB: [6, -12],
  legF: [-6, 6],
  legB: [6, -2],
  feet: 0.75,
  look: [0.6, 0],
  blink: 0,
  mouth: 'grin',
  dizzy: 0,
})

export const PARTS = [
  'root', 'torso', 'head', 'hat', 'armF', 'foreF', 'armB', 'foreB',
  'legF', 'shinF', 'footF', 'legB', 'shinB', 'footB', 'eyes', 'pupils', 'eyesDizzy', 'stars',
  'grin', 'open', 'chomp', 'worried',
] as const
export type Parts = Record<(typeof PARTS)[number], SVGGElement>

export const f = (n: number) => Math.round(n * 100) / 100

export function applyPose(p: Parts, pose: Pose, time: number) {
  p.root.setAttribute('transform', `translate(${f(pose.x)} ${f(pose.y)}) scale(${f(pose.sx)} ${f(pose.sy)})`)
  p.torso.setAttribute(
    'transform',
    `rotate(${f(pose.lean)} 0 -20) translate(0 ${f(pose.bob - 20)}) scale(1 ${f(pose.breath)}) translate(0 20)`,
  )
  p.head.setAttribute('transform', `translate(5 -53) rotate(${f(pose.head)}) scale(1.12)`)
  p.hat.setAttribute('transform', `translate(${f(1.5 + pose.hatX)} ${f(-26.5 + pose.hatY)}) rotate(${f(-9 + pose.hatRot)})`)
  p.hat.style.display = pose.hatOff ? 'none' : ''

  p.armF.setAttribute('transform', `translate(11 -46) rotate(${f(pose.armF[0])})`)
  p.foreF.setAttribute('transform', `translate(0 13) rotate(${f(pose.armF[1])})`)
  p.armB.setAttribute('transform', `translate(-7 -47) rotate(${f(pose.armB[0])})`)
  p.foreB.setAttribute('transform', `translate(0 13) rotate(${f(pose.armB[1])})`)

  const leg = (thigh: SVGGElement, shin: SVGGElement, foot: SVGGElement, hipX: number, [a, b]: Limb) => {
    thigh.setAttribute('transform', `translate(${hipX} -20) rotate(${f(a)})`)
    shin.setAttribute('transform', `translate(0 8.5) rotate(${f(b)})`)
    // Soles stay close to flat, like cartoon feet do.
    foot.setAttribute('transform', `translate(0 7.5) rotate(${f(-(a + b) * pose.feet)})`)
  }
  leg(p.legF, p.shinF, p.footF, 6, pose.legF)
  leg(p.legB, p.shinB, p.footB, -6, pose.legB)

  const open = Math.max(0.08, 1 - pose.blink)
  p.eyes.setAttribute('transform', `translate(7.6 -17.5) scale(1 ${f(open)}) translate(-7.6 17.5)`)
  p.pupils.setAttribute('transform', `translate(${f(pose.look[0])} ${f(pose.look[1])})`)
  const dizzy = pose.dizzy > 0
  p.eyes.style.display = dizzy ? 'none' : ''
  p.eyesDizzy.style.display = dizzy ? '' : 'none'
  if (dizzy) p.eyesDizzy.setAttribute('transform', `rotate(${f(time * 540)} 7.6 -17.5)`)
  p.stars.style.display = dizzy ? '' : 'none'
  if (dizzy) {
    p.stars.style.opacity = String(Math.min(1, pose.dizzy))
    Array.from(p.stars.children).forEach((star, i) => {
      const a = time * 4.2 + (i * Math.PI * 2) / 3
      const x = Math.cos(a) * 15
      const y = Math.sin(a) * 4.5
      star.setAttribute('transform', `translate(${f(x)} ${f(y)}) scale(${f(0.8 + Math.sin(a) * 0.25)})`)
    })
  }
  for (const m of ['grin', 'open', 'chomp', 'worried'] as const) p[m].style.display = pose.mouth === m ? '' : 'none'
}
