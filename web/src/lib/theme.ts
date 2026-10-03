export type ThemeChoice = 'light' | 'dark'

const KEY = 'ieri.theme'

export function getTheme(): ThemeChoice {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme(choice: ThemeChoice = getTheme()) {
  const dark = choice === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141216' : '#A02848')
}

export function setTheme(choice: ThemeChoice) {
  localStorage.setItem(KEY, choice)
  applyTheme(choice)
}

const TOKENS = [
  '--color-surface',
  '--color-paper',
  '--color-ink',
  '--color-muted',
  '--color-line',
  '--color-bordeaux',
  '--color-bordeaux-dark',
  '--color-bordeaux-soft',
  '--color-giallo',
  '--color-giallo-soft',
  '--color-azzurro',
  '--color-azzurro-ink',
  '--color-azzurro-soft',
  '--color-verde',
  '--color-verde-ink',
  '--color-verde-soft',
  '--color-rosa',
  '--color-rosa-ink',
  '--color-rosa-soft',
  '--color-viola',
  '--color-viola-ink',
  '--color-viola-soft',
] as const

/** Same values as index.css. Inline copies are what the browser can blend. */
const LIGHT: Record<(typeof TOKENS)[number], string> = {
  '--color-surface': '#ffffff',
  '--color-paper': '#f6f4f1',
  '--color-ink': '#1d1b1e',
  '--color-muted': '#6b6570',
  '--color-line': '#e7e2de',
  '--color-bordeaux': '#a02848',
  '--color-bordeaux-dark': '#7e1d37',
  '--color-bordeaux-soft': '#f7e6eb',
  '--color-giallo': '#f8b828',
  '--color-giallo-soft': '#fff4d6',
  '--color-azzurro': '#1898c8',
  '--color-azzurro-ink': '#0b6a92',
  '--color-azzurro-soft': '#e3f3fa',
  '--color-verde': '#80b830',
  '--color-verde-ink': '#4a7512',
  '--color-verde-soft': '#eef6e1',
  '--color-rosa': '#e01058',
  '--color-rosa-ink': '#b00c45',
  '--color-rosa-soft': '#fde6ee',
  '--color-viola': '#8038b8',
  '--color-viola-ink': '#6a2a9c',
  '--color-viola-soft': '#f2e9f9',
}

const DARK: Record<(typeof TOKENS)[number], string> = {
  ...LIGHT,
  '--color-surface': '#1e1b21',
  '--color-paper': '#141216',
  '--color-ink': '#f2eef1',
  '--color-muted': '#a8a1ab',
  '--color-line': '#36313b',
  '--color-bordeaux': '#c83b62',
  '--color-bordeaux-dark': '#a52d4f',
  '--color-bordeaux-soft': '#3b1824',
  '--color-giallo-soft': '#3a2f10',
  '--color-azzurro-ink': '#74c7ec',
  '--color-azzurro-soft': '#0f2b38',
  '--color-verde-ink': '#a9d873',
  '--color-verde-soft': '#1e2b12',
  '--color-rosa-ink': '#ff7fa9',
  '--color-rosa-soft': '#3d1121',
  '--color-viola-ink': '#c99cf0',
  '--color-viola-soft': '#2b1a3b',
}

let blendTimer = 0

function paint(values: Record<(typeof TOKENS)[number], string>) {
  const root = document.documentElement
  for (const token of TOKENS) root.style.setProperty(token, values[token])
}

function releaseInlineColors() {
  const root = document.documentElement
  root.style.setProperty('transition', 'none')
  for (const token of TOKENS) root.style.removeProperty(token)
  root.classList.remove('theme-anim')
  void root.offsetWidth
  root.style.removeProperty('transition')
}

/** Blends every theme color, then leaves the normal stylesheet in charge. */
export function animateTheme(choice: ThemeChoice) {
  window.clearTimeout(blendTimer)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    releaseInlineColors()
    setTheme(choice)
    return
  }
  const root = document.documentElement
  const computed = getComputedStyle(root)
  const snapshot = TOKENS.map((token) => [token, computed.getPropertyValue(token)] as const)
  root.style.setProperty('transition', 'none')
  for (const [token, value] of snapshot) root.style.setProperty(token, value)
  void root.offsetWidth
  root.style.removeProperty('transition')
  root.classList.add('theme-anim')
  // The transition has to be active for a frame before the colors change, or the browser skips it.
  void root.offsetWidth
  setTheme(choice)
  paint(choice === 'dark' ? DARK : LIGHT)
  blendTimer = window.setTimeout(releaseInlineColors, 520)
}

applyTheme()
