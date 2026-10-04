import { GROUND, WINDOW_FLOOR } from '../../lib/magilla-game'
import { C } from './rig'

/** Street props for the 404 game. Obstacles use their box: origin at bottom-left, drawn up to -h. */

const line = { stroke: C.ink, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

const RED = '#d8352c'
const RED_DARK = '#a3241e'
const STEEL = '#a4adb7'
const STEEL_DARK = '#76808b'
const WOOD = '#dba663'
const WOOD_DARK = '#a8743a'
export const BANANA = '#f9d342'

export function Hydrant() {
  return (
    <g>
      <rect x={1} y={-4} width={20} height={4} rx={1} fill={RED_DARK} {...line} />
      <path d="M 4.5 -4 L 5 -21 L 17 -21 L 17.5 -4 Z" fill={RED} {...line} />
      <path d="M 3 -21 C 3 -30 19 -30 19 -21 Z" fill={RED} {...line} />
      <rect x={2.5} y={-22.5} width={17} height={3} rx={1.2} fill={RED_DARK} {...line} strokeWidth={1.2} />
      <rect x={9} y={-31} width={4} height={3} rx={1} fill={RED_DARK} {...line} strokeWidth={1.1} />
      <rect x={-0.5} y={-16.5} width={5.5} height={6} rx={1.2} fill={RED} {...line} />
      <rect x={17} y={-16.5} width={5.5} height={6} rx={1.2} fill={RED} {...line} />
      <circle cx={11} cy={-13.5} r={2.6} fill={RED_DARK} {...line} strokeWidth={1.1} />
      <path d="M 7 -19 L 7 -7" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

export function TrashCan() {
  return (
    <g>
      <path d="M 2 -33 L 4 0 L 22 0 L 24 -33 Z" fill={STEEL} {...line} />
      <path d="M 8 -30 L 8.6 -3 M 13 -30 L 13 -3 M 18 -30 L 17.4 -3" stroke={STEEL_DARK} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 2.6 -22 L 23.4 -22 M 3.4 -10 L 22.6 -10" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1} />
      {/* Lid, knocked a bit sideways */}
      <g transform="rotate(-9 13 -35)">
        <path d="M 0 -34 C 0 -38.5 26 -38.5 26 -34 C 26 -31.5 0 -31.5 0 -34 Z" fill="#c3cad2" {...line} />
        <path d="M 10 -37.6 C 10 -41 16 -41 16 -37.6" fill="none" {...line} />
      </g>
      {/* A peel Magilla left behind */}
      <path d="M 21 -34 C 25 -33 27.5 -29 27 -24 C 25.6 -27 24 -29 22.4 -30 Z" fill={BANANA} {...line} strokeWidth={1.1} />
      <path d="M 19 -34 C 19.6 -30 18.6 -27 17 -25 C 18.8 -26.6 20.4 -29 21 -32 Z" fill={BANANA} {...line} strokeWidth={1.1} />
      <path d="M 5.6 -29 L 6.6 -6" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function Crate({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={-h} width={w} height={h} rx={1.2} fill={WOOD} {...line} />
      <path d={`M 0 ${-h + 4} H ${w} M 0 -4 H ${w}`} stroke={WOOD_DARK} strokeWidth={1.2} />
      <path d={`M 2.5 -4 L ${w - 2.5} ${-h + 4}`} stroke={WOOD_DARK} strokeWidth={2.4} strokeLinecap="round" />
      {label && (
        <g transform={`translate(${w / 2} ${-h / 2}) rotate(-8)`}>
          <circle r={5.6} fill="#fff6d6" {...line} strokeWidth={1} />
          <path d="M -3.6 -0.6 C -2 2.6 2.4 2.8 4 -1 C 2.4 0.4 -1 0.6 -2.8 -2 Z" fill={BANANA} {...line} strokeWidth={0.8} />
        </g>
      )}
    </g>
  )
}

export function Crates() {
  return (
    <g>
      <Crate x={0} y={0} w={24} h={26} label />
      <Crate x={24} y={0} w={24} h={30} />
    </g>
  )
}

export function Stack() {
  return (
    <g>
      <Crate x={0} y={0} w={30} h={26} />
      <g transform="rotate(-4 15 -26)">
        <Crate x={3} y={-26} w={25} h={24} label />
      </g>
    </g>
  )
}

export function Pigeon() {
  return (
    <g>
      <path d="M 24 -9 L 31 -12 L 31 -5 Z" fill="#7f8796" {...line} strokeWidth={1.2} />
      <path d="M 4 -9 C 4 -14 12 -16 19 -14 C 25 -12 27 -8 24 -5 C 20 -2 9 -2 5 -5 Z" fill="#a9b1bf" {...line} />
      <path d="M 6.6 -12.4 C 8.4 -10.6 8.6 -7 7 -5" fill="none" stroke="#5fae86" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M 7.6 -12 C 9 -10.2 9 -7.4 8 -5.6" fill="none" stroke="#9a6ac4" strokeWidth={1.2} strokeLinecap="round" />
      <circle cx={4.6} cy={-12.4} r={4.2} fill="#8d95a4" {...line} />
      <path d="M 0.8 -12.4 L -3 -11.4 L 0.8 -10.8 Z" fill="#f2a63c" {...line} strokeWidth={1} />
      <circle cx={3.6} cy={-13.4} r={1.3} fill="#fff" />
      <circle cx={3.3} cy={-13.4} r={0.7} fill={C.ink} />
      <g data-wing>
        <path d="M 10 -12 C 12 -22 20 -26 27 -25 C 24 -20 20 -14 16 -12 Z" fill="#8d95a4" {...line} />
        <path d="M 15 -14 C 18 -18 21 -20 24 -21.4" fill="none" stroke={C.ink} strokeOpacity={0.4} strokeWidth={1} />
      </g>
      <path d="M 12 -2.6 L 11 0.6 M 16 -2.6 L 16.6 0.6" stroke="#f2a63c" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

export function BananaShape({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path d="M -8 -3.4 C -5.6 4.8 5.6 6 9.2 -2.4 C 6.8 0.4 -1.6 1.6 -5.4 -5.2 Z" fill={BANANA} {...line} strokeWidth={1.3} />
      <path d="M -4.6 -2.4 C -2 1.6 3.6 2.4 7 -0.4" fill="none" stroke="#d9a520" strokeWidth={1} strokeLinecap="round" />
      <path d="M -8 -3.4 L -9.6 -5.6 L -7.8 -6.6 L -5.4 -5.2" fill="#7a5520" {...line} strokeWidth={1} />
      <path d="M 9.2 -2.4 L 10.2 -1.6" stroke={C.ink} strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

/** Mr. Peebles' pet shop. Everything here is in world units, drawn from x = 0. */
export function ShopBack() {
  const stripes = Array.from({ length: 12 }, (_, i) => i)
  return (
    <g>
      <rect x={0} y={18} width={236} height={GROUND - 18} className="fill-bordeaux-soft" />
      <path
        d={Array.from({ length: 16 }, (_, r) => `M 0 ${26 + r * 11} H 236`).join(' ')}
        className="stroke-bordeaux"
        strokeOpacity={0.12}
        strokeWidth={1}
      />
      <rect x={22} y={26} width={192} height={24} rx={4} className="fill-bordeaux" stroke={C.ink} strokeWidth={1.5} />
      <text x={118} y={42.5} textAnchor="middle" fill="#fff" fontSize={11.5} fontWeight={800} letterSpacing={1.4}>
        PEEBLES' PET SHOP
      </text>
      {/* Awning */}
      <g>
        {stripes.map((i) => (
          <path
            key={i}
            d={`M ${30 + i * 15} 56 h 15 v 13 a 7.5 6 0 0 1 -15 0 Z`}
            className={i % 2 === 0 ? 'fill-bordeaux' : 'fill-surface'}
            stroke={C.ink}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        ))}
        <rect x={27} y={53} width={186} height={4} rx={2} className="fill-bordeaux-dark" stroke={C.ink} strokeWidth={1.3} />
      </g>
      {/* Window, lit from inside */}
      <rect x={42} y={84} width={128} height={WINDOW_FLOOR - 84} fill="#fff1c7" />
      <path d="M 42 112 H 170 M 42 140 H 170" stroke="#e6cf96" strokeWidth={2} />
      <g transform="translate(52 112)">
        <rect x={0} y={-12} width={12} height={12} rx={1.5} fill="#bfe3f2" stroke={C.ink} strokeWidth={1} />
        <path d="M 2 -4 c 2 -3 5 -3 8 0" fill="none" stroke="#1898c8" strokeWidth={1.2} />
      </g>
      <g transform="translate(150 140)">
        <rect x={0} y={-10} width={12} height={10} rx={1.5} fill="#f6d6a4" stroke={C.ink} strokeWidth={1} />
        <text x={6} y={-3} textAnchor="middle" fontSize={5} fontWeight={800} fill={C.ink}>
          BONES
        </text>
      </g>
      <rect x={42} y={WINDOW_FLOOR - 6} width={128} height={6} fill="#efd79b" />
      {/* Peels from the last few lunches */}
      <g transform={`translate(66 ${WINDOW_FLOOR - 1})`}>
        <path d="M 0 0 C 2 -4 6 -5 8 -3 C 5 -3 3 -2 2 0 Z" fill={BANANA} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
        <path d="M 2 0 C 4 -2 9 -1 11 1 Z" fill={BANANA} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
      </g>
      {/* Door */}
      <rect x={184} y={84} width={40} height={GROUND - 84} rx={2} className="fill-bordeaux-dark" stroke={C.ink} strokeWidth={1.5} />
      <rect x={190} y={92} width={28} height={40} rx={2} fill="#fff1c7" stroke={C.ink} strokeWidth={1.2} />
      <rect x={193} y={100} width={22} height={10} rx={1.5} className="fill-surface" stroke={C.ink} strokeWidth={1} />
      <text x={204} y={107.6} textAnchor="middle" fontSize={6.5} fontWeight={800} className="fill-bordeaux">
        OPEN
      </text>
      <circle cx={215} cy={152} r={2.2} fill={C.button} stroke={C.ink} strokeWidth={1} />
    </g>
  )
}

export function ShopFront() {
  return (
    <g>
      <rect x={42} y={84} width={128} height={WINDOW_FLOOR - 84} fill="none" stroke={C.ink} strokeWidth={3} />
      <rect x={36} y={WINDOW_FLOOR} width={140} height={GROUND - WINDOW_FLOOR} className="fill-bordeaux-dark" stroke={C.ink} strokeWidth={1.5} />
      <rect x={44} y={WINDOW_FLOOR + 5} width={56} height={10} rx={1.5} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1.2} />
      <rect x={112} y={WINDOW_FLOOR + 5} width={56} height={10} rx={1.5} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1.2} />
      <rect x={34} y={WINDOW_FLOOR - 2} width={144} height={4} rx={1.5} className="fill-surface" stroke={C.ink} strokeWidth={1.3} />
    </g>
  )
}

export function Glass() {
  return (
    <g>
      <rect x={42} y={84} width={128} height={WINDOW_FLOOR - 84} fill="#e9f7ff" fillOpacity={0.22} />
      <path d="M 58 84 L 44 106 M 70 84 L 46 122 M 150 84 L 106 154" stroke="#fff" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round" />
      <path d="M 160 120 L 132 168" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

export function PriceTag() {
  return (
    <g>
      <path d="M 0 0 L 0 12" stroke={C.ink} strokeWidth={1} />
      <g transform="translate(0 12)">
        <path d="M -16 4 L -11 0 L 16 0 L 16 22 L -11 22 L -16 18 Z" fill="#fffdf6" stroke={C.ink} strokeWidth={1.3} strokeLinejoin="round" />
        <circle cx={-11} cy={11} r={1.6} fill="none" stroke={C.ink} strokeWidth={1} />
        <text x={2.5} y={8.4} textAnchor="middle" fontSize={6.6} fontWeight={700} fill="#6b6570">
          $9.99
        </text>
        <path d="M -5.6 6.2 L 10.6 5.2" stroke="#e01058" strokeWidth={1.3} strokeLinecap="round" />
        <text x={2.5} y={18.6} textAnchor="middle" fontSize={9} fontWeight={900} fill="#a02848">
          $4.04
        </text>
      </g>
    </g>
  )
}

/** Far skyline, one 640-unit tile. */
export function Skyline() {
  const blocks: [number, number, number][] = [
    [0, 60, 34], [36, 92, 28], [66, 48, 40], [108, 112, 30], [140, 70, 44], [186, 54, 26],
    [214, 98, 36], [252, 64, 30], [284, 120, 26], [312, 76, 40], [354, 52, 34], [390, 104, 30],
    [422, 66, 42], [466, 88, 28], [496, 58, 36], [534, 116, 30], [566, 72, 40], [608, 50, 32],
  ]
  return (
    <g>
      {blocks.map(([x, h, w]) => (
        <g key={x}>
          <rect x={x} y={GROUND - h} width={w} height={h} className="fill-line" />
          {Array.from({ length: Math.floor((h - 14) / 14) }, (_, r) =>
            Array.from({ length: Math.floor((w - 6) / 10) }, (_, c) => (
              <rect
                key={`${r}-${c}`}
                x={x + 5 + c * 10}
                y={GROUND - h + 8 + r * 14}
                width={4}
                height={6}
                rx={0.8}
                className={(x + r * 3 + c * 7) % 5 === 0 ? 'fill-surface dark:fill-giallo/70' : 'fill-surface/70 dark:fill-paper/60'}
              />
            )),
          )}
        </g>
      ))}
    </g>
  )
}

export function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M -24 6 C -30 6 -30 -3 -22 -3 C -22 -11 -10 -13 -6 -6 C -3 -15 13 -15 14 -4 C 22 -6 26 6 18 6 Z"
      className="fill-surface dark:fill-line/70"
    />
  )
}

export function Lamp({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} ${GROUND - 4})`}>
      <circle cx={0} cy={-90} r={14} className="hidden fill-giallo/25 dark:block" />
      <rect x={-1.6} y={-86} width={3.2} height={86} className="fill-ink/25" />
      <rect x={-4} y={-6} width={8} height={6} rx={1} className="fill-ink/25" />
      <path d="M -6 -86 L 6 -86 L 4 -95 L -4 -95 Z" className="fill-ink/30" />
      <rect x={-3.6} y={-93} width={7.2} height={6} className="fill-giallo-soft dark:fill-giallo" />
    </g>
  )
}
