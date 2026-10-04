import { useCallback, type RefObject } from 'react'
import { applyPose, C, f, PARTS, restPose, type Parts } from './rig'

/**
 * Magilla Gorilla as an SVG puppet: small purple derby, purple bow tie, red shorts on green
 * suspenders, brown shoes. Origin is between his feet; he faces right. Every joint is a <g>
 * that applyPose() turns, so the game drives him frame by frame without React renders.
 */

const line = { stroke: C.ink, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

export function HatShape() {
  return (
    <>
      <path d="M -6.8 0 C -7.4 -10 7.4 -10 6.8 0 Z" fill={C.hat} {...line} />
      <path d="M -6.9 -2.8 C -2.5 -2 2.5 -2 6.9 -2.8 L 6.85 -0.2 C 2.5 0.4 -2.5 0.4 -6.85 -0.2 Z" fill={C.hatBand} {...line} strokeWidth={1.1} />
      <path d="M -10.5 0.6 C -8 3.2 8 3.2 10.5 0.6 C 8 -1.4 -8 -1.4 -10.5 0.6 Z" fill={C.hat} {...line} />
      <path d="M -3.6 -6.4 C -2.4 -7.6 -0.6 -7.9 0.8 -7.8" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
    </>
  )
}

export function Star({ size = 3 }: { size?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? size : size * 0.45
    const a = (i * Math.PI) / 5 - Math.PI / 2
    return `${f(Math.cos(a) * r)},${f(Math.sin(a) * r)}`
  }).join(' ')
  return <polygon points={pts} fill={C.star} stroke={C.ink} strokeWidth={0.8} strokeLinejoin="round" />
}

function Arm({ part, fore, back }: { part: 'armF' | 'armB'; fore: 'foreF' | 'foreB'; back?: boolean }) {
  const fur = back ? C.furBack : C.fur
  const skin = back ? C.skinBack : C.skin
  return (
    <g data-p={part}>
      <path d="M -5.8 -2 C -6.6 4 -5.8 10 -4.8 14 L 4.8 14 C 5.8 10 6.6 4 5.8 -2 C 3.8 -6.6 -3.8 -6.6 -5.8 -2 Z" fill={fur} {...line} />
      <g data-p={fore}>
        <g transform="translate(0 10.8) scale(1.15)">
          <path d="M -4.8 -0.6 C -6.6 3 -5.8 8.6 -1.2 9.8 C 3.4 10.8 6.8 7.4 5.8 2.6 C 5.4 0.6 5 -0.4 4.6 -0.8 Z" fill={skin} {...line} />
          <path d="M 5.2 1.4 C 8.2 1.8 8.8 5.2 6.4 6.6" fill={skin} {...line} />
          <path d="M -1.6 9.4 L -1 6.6 M 1.6 9.8 L 1.9 6.9" fill="none" {...line} strokeWidth={1} />
        </g>
        <path d="M -4.9 -0.6 C -6.8 3.5 -6.8 7.5 -5.8 11.4 C -2.4 12.9 2.8 12.9 6 11.4 C 7 7.5 6.8 3.5 4.9 -0.6 Z" fill={fur} {...line} />
        <path d="M -5.4 10.8 l 1.4 -1.6 M -1.4 12.2 l 0.8 -1.8 M 2.4 12.2 l 0.4 -1.8" fill="none" {...line} strokeWidth={0.9} />
      </g>
    </g>
  )
}

function Leg({ thigh, shin, foot, back }: { thigh: 'legF' | 'legB'; shin: 'shinF' | 'shinB'; foot: 'footF' | 'footB'; back?: boolean }) {
  const fur = back ? C.furBack : C.fur
  return (
    <g data-p={thigh}>
      <path d="M -6 -2 C -6.4 3 -6.2 6 -5.6 9.2 L 5.6 9.2 C 6.2 6 6.4 3 6 -2 Z" fill={fur} {...line} />
      <g data-p={shin}>
        <path d="M -5.4 -0.4 C -5.7 3 -5.3 5.6 -4.9 7.8 L 5.1 7.8 C 5.5 5.6 5.7 3 5.4 -0.4 Z" fill={fur} {...line} />
        <g data-p={foot}>
          <g transform="scale(1.1)">
            <path
              d="M -5.2 -1.4 C -7 2 -5.2 4.8 -0.4 4.8 L 7.2 4.8 C 11.2 4.8 12 1.2 9.6 -0.8 C 7.2 -2.6 0 -2.8 -5.2 -1.4 Z"
              fill={back ? C.shoeBack : C.shoe}
              {...line}
            />
            <path d="M 4.6 0.2 C 6.2 -0.4 7.8 -0.2 8.6 0.6" fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round" />
          </g>
        </g>
      </g>
    </g>
  )
}

export function MagillaSprite({ partsRef }: { partsRef: RefObject<Parts | null> }) {
  const collect = useCallback(
    (node: SVGGElement | null) => {
      if (!node) {
        partsRef.current = null
        return
      }
      const found = { root: node } as Partial<Parts>
      for (const name of PARTS) {
        if (name === 'root') continue
        found[name] = node.querySelector<SVGGElement>(`[data-p="${name}"]`)!
      }
      partsRef.current = found as Parts
      applyPose(found as Parts, restPose(), 0)
    },
    [partsRef],
  )

  return (
    <g ref={collect}>
      {/* Contact shadow is drawn by the scene so it stays on the street when he jumps. */}
      <Leg thigh="legB" shin="shinB" foot="footB" back />
      <Leg thigh="legF" shin="shinF" foot="footF" />
      <g data-p="torso">
        <Arm part="armB" fore="foreB" back />
        {/* Body, chest, shorts, suspenders */}
        <path d="M -15 -25 C -21 -36 -19 -50 -9 -55.5 C 0 -60 13 -58.5 18 -50 C 23 -42 22 -30 18 -23 C 10 -16 -9 -16 -15 -25 Z" fill={C.fur} {...line} />
        <path d="M 3.5 -47.5 C 12 -50.5 19 -43 18.2 -35 C 17.6 -29.5 10 -27.5 5 -30 C 0.6 -33.5 -0.4 -43.5 3.5 -47.5 Z" fill={C.skin} {...line} strokeWidth={1.1} />
        <path d="M -9.6 -44 l -1.6 1.4 M -12 -38.5 l -1.8 1 M -7.5 -50.5 l -1.4 1.6" fill="none" {...line} strokeWidth={1} />
        <path
          d="M -17.6 -32 C -6 -28 8 -28 20.6 -33 C 21.6 -27 20.6 -21 17.6 -17.4 L 9.6 -15.4 L 3 -20.4 L -3 -15.4 L -12.6 -16.4 C -16.6 -20 -18.1 -26 -17.6 -32 Z"
          fill={C.shorts}
          {...line}
        />
        <path d="M -16.6 -29 C -5 -25.4 8 -25.4 20.4 -30" fill="none" {...line} strokeWidth={1} strokeOpacity={0.5} />
        <path d="M 5.6 -30.2 C 6.8 -40 6.6 -49 4.2 -56.6" fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
        <path d="M 5.6 -30.2 C 6.8 -40 6.6 -49 4.2 -56.6" fill="none" stroke={C.strap} strokeWidth={3} strokeLinecap="round" />
        <path d="M -10.4 -29.8 C -11 -40 -8.6 -50 -3.6 -56.6" fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
        <path d="M -10.4 -29.8 C -11 -40 -8.6 -50 -3.6 -56.6" fill="none" stroke={C.strap} strokeWidth={3} strokeLinecap="round" />
        <circle cx={5.6} cy={-30.4} r={1.6} fill={C.button} {...line} strokeWidth={0.9} />
        <circle cx={-10.4} cy={-30} r={1.6} fill={C.button} {...line} strokeWidth={0.9} />

        <g data-p="head">
          <path d="M -12 -9 C -13.4 -20 -6 -28.4 3 -28.4 C 12 -28.4 17.4 -21 17.2 -13 C 17 -6 13 0 4 1.2 C -5 2.2 -11 -2 -12 -9 Z" fill={C.fur} {...line} />
          <path d="M -6 -24.6 l -1.6 -1.8 M -9.6 -20 l -2 -1" fill="none" {...line} strokeWidth={1} />
          <ellipse cx={-10.4} cy={-11} rx={3.3} ry={4.3} fill={C.skin} {...line} />
          <path d="M -10 -13 C -11.4 -11.6 -11.2 -9.6 -9.8 -8.8" fill="none" {...line} strokeWidth={1} />
          <path
            d="M 0 -17 C -1 -23.4 5 -25.4 7.6 -20.8 C 10.2 -25.4 16.8 -23.4 16.2 -17 C 20.4 -15 23.8 -10 23.2 -5 C 22.6 1.2 16 4.2 9 3.7 C 2 3.2 -2.6 -1 -2 -6 C -1.8 -9 -0.4 -11 0 -13 C -0.6 -14.6 -0.6 -16 0 -17 Z"
            fill={C.skin}
            {...line}
          />
          <g data-p="eyes">
            <ellipse cx={4.4} cy={-17.4} rx={2.6} ry={3.4} fill="#fff" {...line} strokeWidth={1.1} />
            <ellipse cx={10.9} cy={-17.6} rx={2.6} ry={3.4} fill="#fff" {...line} strokeWidth={1.1} />
            <g data-p="pupils">
              <circle cx={5} cy={-16.9} r={1.45} fill={C.ink} />
              <circle cx={11.5} cy={-17.1} r={1.45} fill={C.ink} />
              <circle cx={5.4} cy={-17.5} r={0.45} fill="#fff" />
              <circle cx={11.9} cy={-17.7} r={0.45} fill="#fff" />
            </g>
          </g>
          <g data-p="eyesDizzy" style={{ display: 'none' }}>
            <ellipse cx={4.4} cy={-17.4} rx={2.6} ry={3.4} fill="#fff" {...line} strokeWidth={1.1} />
            <ellipse cx={10.9} cy={-17.6} rx={2.6} ry={3.4} fill="#fff" {...line} strokeWidth={1.1} />
            <path d="M 4.4 -17.4 c 0.8 -0.6 1.5 0.4 0.8 1.1 c -0.9 0.9 -2.3 0 -2 -1.3 c 0.3 -1.4 2.4 -1.8 3 -0.4" fill="none" {...line} strokeWidth={0.9} />
            <path d="M 10.9 -17.6 c 0.8 -0.6 1.5 0.4 0.8 1.1 c -0.9 0.9 -2.3 0 -2 -1.3 c 0.3 -1.4 2.4 -1.8 3 -0.4" fill="none" {...line} strokeWidth={0.9} />
          </g>
          {/* Nose */}
          <path d="M 13.6 -12.8 C 13.2 -9.8 15.2 -8.8 16.8 -9.8 C 18.4 -8.8 20.8 -9.4 20.6 -12.2" fill="none" {...line} strokeWidth={1.2} />
          <ellipse cx={15.6} cy={-11} rx={1.15} ry={0.75} fill={C.ink} transform="rotate(-20 15.6 -11)" />
          <ellipse cx={18.8} cy={-11.1} rx={1.15} ry={0.75} fill={C.ink} transform="rotate(20 18.8 -11.1)" />
          {/* Mouths */}
          <g data-p="grin">
            <path d="M 7.8 -5.6 C 12 -5.8 18 -6.2 22.2 -6.6 C 20.6 -0.4 10.8 0.8 7.8 -5.6 Z" fill={C.mouth} {...line} strokeWidth={1.3} />
            <path d="M 9 -5.5 C 13 -5.8 17.6 -6.1 21.2 -6.4 L 20.8 -4.6 C 17 -4.2 12.6 -4 9.6 -4.4 Z" fill="#fff" />
            <path d="M 12.6 -1.9 C 14.2 -2.9 16.2 -2.9 17.6 -2.2 C 16 -0.9 14 -0.9 12.6 -1.9 Z" fill={C.tongue} />
            <path d="M 6.8 -7 L 8.2 -4.7 M 21.6 -7.9 L 23 -5.6" fill="none" {...line} strokeWidth={1.1} />
          </g>
          <g data-p="open" style={{ display: 'none' }}>
            <ellipse cx={15.2} cy={-3.6} rx={3.2} ry={3.8} fill={C.mouth} {...line} strokeWidth={1.3} />
            <path d="M 13 -1.4 C 14.4 -2.6 16.2 -2.6 17.4 -1.4 C 16 -0.2 14.4 -0.2 13 -1.4 Z" fill={C.tongue} />
          </g>
          <g data-p="chomp" style={{ display: 'none' }}>
            <path d="M 7.4 -6.6 C 12.6 -7.6 18.4 -8 23 -7.6 C 22.6 2 9.4 3.6 7.4 -6.6 Z" fill={C.mouth} {...line} strokeWidth={1.3} />
            <path d="M 8.6 -6.6 C 13 -7.4 18 -7.7 21.8 -7.4 L 21.4 -5.6 C 17.6 -5.4 12.6 -5 9.2 -5 Z" fill="#fff" />
            <path d="M 11.4 -0.8 C 13.6 -3 17.6 -3 19.8 -1 C 17.2 1.2 13.8 1.2 11.4 -0.8 Z" fill={C.tongue} />
          </g>
          <g data-p="worried" style={{ display: 'none' }}>
            <path d="M 8.6 -3.4 Q 10.8 -5.6 13 -3.6 T 17.4 -3.8 T 21.6 -4.6" fill="none" {...line} strokeWidth={1.3} />
          </g>
          <g data-p="hat">
            <HatShape />
          </g>
          <g data-p="stars" transform="translate(2 -30)" style={{ display: 'none' }}>
            <g><Star /></g>
            <g><Star /></g>
            <g><Star /></g>
          </g>
        </g>

        {/* Bow tie sits on top of the chin */}
        <g transform="translate(7.4 -51.4) rotate(-6)">
          <path d="M 0 0 L -6.8 -4 C -8 -1.4 -8 1.6 -6.8 4.2 Z" fill={C.hat} {...line} />
          <path d="M 0 0 L 6.8 -4 C 8 -1.4 8 1.6 6.8 4.2 Z" fill={C.hat} {...line} />
          <rect x={-2} y={-2.2} width={4} height={4.4} rx={1.2} fill={C.hatBand} {...line} strokeWidth={1.1} />
        </g>
        <Arm part="armF" fore="foreF" />
      </g>
    </g>
  )
}
