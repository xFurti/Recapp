import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './i18n/en.json'
import it from './i18n/it.json'

const KEY = 'ieri.lang'
const saved = localStorage.getItem(KEY)
const initial = saved === 'en' ? 'en' : 'it'

i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = initial

export function setLanguage(lang: 'it' | 'en') {
  localStorage.setItem(KEY, lang)
  document.documentElement.lang = lang
  i18n.changeLanguage(lang)
}

export default i18n
