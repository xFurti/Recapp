import { flushSync } from 'react-dom'
import { initializeLanguage, transitionLanguage } from './lib/language-transition'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './i18n/en.json'
import it from './i18n/it.json'

const KEY = 'ieri.lang'
const saved = localStorage.getItem(KEY)
const initial = saved === 'it' ? 'it' : 'en'

i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = initial
initializeLanguage(initial)

export function setLanguage(lang: 'it' | 'en') {
  localStorage.setItem(KEY, lang)
  transitionLanguage(lang, () => {
    const position = { left: window.scrollX, top: window.scrollY }
    const scrollers = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .filter(element => element.scrollTop !== 0 || element.scrollLeft !== 0)
      .map(element => ({ element, left: element.scrollLeft, top: element.scrollTop }))
    document.documentElement.lang = lang
    // Translations are bundled; commit React text updates at zero opacity.
    flushSync(() => { void i18n.changeLanguage(lang) })
    // Translation lengths can trigger native scroll anchoring; keep the user's
    // current position, including scrollable dialogs, through that reflow.
    for (const { element, left, top } of scrollers) element.scrollTo({ left, top, behavior: 'instant' })
    window.scrollTo({ ...position, behavior: 'instant' })
  })
}

export default i18n
