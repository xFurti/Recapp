// One coordinated fade, shared by normal content and portaled dialogs.
let selected: 'it' | 'en'
let timer = 0
const listeners = new Set<() => void>()

export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const selectedLanguage = () => selected

export function initializeLanguage(language: 'it' | 'en') {
  selected = language
}

export function transitionLanguage(language: 'it' | 'en', commit: () => void) {
  if (language === selected) return
  selected = language
  listeners.forEach(listener => listener())
  window.clearTimeout(timer)
  const root = document.documentElement
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    delete root.dataset.languageTransition
    commit()
    return
  }
  // Repeated requests retarget this fade instead of queuing callbacks. Keeping
  // the current CSS opacity makes an interrupted fade continuous.
  root.dataset.languageTransition = 'out'
  timer = window.setTimeout(() => {
    commit()
    root.dataset.languageTransition = 'in'
    timer = window.setTimeout(() => { delete root.dataset.languageTransition }, 110)
  }, 90)
}
