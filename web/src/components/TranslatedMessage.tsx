import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { TOptions } from 'i18next'

/** Fade translated words while keeping interpolated names and authored text visible. */
export function TranslatedMessage({ message, values }: { message: string; values: TOptions }) {
  const { t } = useTranslation()
  const options = { ...values }
  const interpolations: string[] = []
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string' || ['lng', 'context', 'defaultValue'].includes(key)) continue
    options[key] = `\uE000${interpolations.length}\uE001`
    interpolations.push(value)
  }
  const text = String(t(message, options))
  let bold = false
  return <>{text.split(/(\uE000\d+\uE001|<\/?b>)/).map((part, index) => {
    if (part === '<b>' || part === '</b>') { bold = part === '<b>'; return null }
    const match = /^\uE000(\d+)\uE001$/.exec(part)
    return match
      ? <Fragment key={`value-${match[1]}`}>{bold ? <strong className="font-extrabold">{interpolations[Number(match[1])]}</strong> : interpolations[Number(match[1])]}</Fragment>
      : <span key={`text-${index}`} className={`language-text ${bold ? 'font-extrabold' : ''}`}>{part}</span>
  })}</>
}
