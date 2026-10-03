export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'ieri.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): ThemeChoice {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function applyTheme(choice: ThemeChoice = getTheme()) {
  const dark = choice === 'dark' || (choice === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141216' : '#A02848')
}

export function setTheme(choice: ThemeChoice) {
  if (choice === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, choice)
  applyTheme(choice)
}

media.addEventListener('change', () => applyTheme())
applyTheme()
