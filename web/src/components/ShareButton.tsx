import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { todayIso } from '../lib/clock'
import { capitalize, longDay, shortDay, subjectColor, subjectName } from '../lib/format'
import { renderShareImage, shareImage } from '../lib/shareImage'
import type { Card, ClassInfo, ItemType } from '../types'
import { Button, Toast } from './ui'

const TYPE_HEX: Record<ItemType, string> = { compito: '#0b6a92', verifica: '#E01058', evento: '#8038B8', lab: '#4a7512' }

export function ShareButton({ card, info }: { card: Card; info: ClassInfo }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const share = async () => {
    setBusy(true)
    try {
      const isToday = card.day === todayIso()
      const dayLabel = capitalize(longDay(card.day, lang))
      const url = `${window.location.origin}/c/${info.code}/giorno/${card.day}`
      const subjects = card.entries
        .filter((e) => e.bullets.length || e.lab || e.attachment_ids?.length)
        .map((e) => ({ name: subjectName(info.subjects, e.subject_code, lang), color: subjectColor(info.subjects, e.subject_code) }))
      const items = [...card.items]
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map((it) => ({
          typeLabel: t(`types.${it.type}`),
          title: it.subject_code ? `${subjectName(info.subjects, it.subject_code, lang)} · ${it.title}` : it.title,
          when: capitalize(shortDay(it.due_date, lang)),
          color: TYPE_HEX[it.type],
        }))
      const blob = await renderShareImage({
        classLabel: info.label,
        dayLabel,
        subjects,
        items,
        url,
        texts: {
          did: t('share.did'),
          upcoming: t('share.upcoming'),
          none: t('share.none'),
          cta: isToday ? t('share.cta_today') : t('share.cta_day', { day: longDay(card.day, lang) }),
        },
      })
      const result = await shareImage(blob, `recapp-${info.name.toLowerCase()}-${card.day}.png`, t('share.message', { cls: info.label, day: dayLabel }), url)
      if (result === 'downloaded') setToast(t('share.downloaded'))
    } catch (e) {
      setToast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={share} loading={busy}>
        <Share2 className="size-4" /> {t('share.button')}
      </Button>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}
