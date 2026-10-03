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

applyTheme()
