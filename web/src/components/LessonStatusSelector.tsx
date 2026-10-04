import { Check, CircleOff, FileCheck2, Users, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { LessonStatus } from '../types'

const OPTIONS: { value: LessonStatus; icon: LucideIcon }[] = [
  { value: 'svolta', icon: Check },
  { value: 'non_svolta', icon: CircleOff },
  { value: 'supplenza', icon: Users },
  { value: 'verifica', icon: FileCheck2 },
]

export function LessonStatusSelector({ subject, value, onChange }: {
  subject: string
  value: LessonStatus
  onChange: (value: LessonStatus) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <fieldset className="lesson-status min-w-0" aria-describedby={`${id}-hint`}>
      <legend className="mb-2 text-xs font-bold text-muted">
        {t('editor.lesson_status')}<span className="sr-only"> · {subject}</span>
      </legend>
      <div className="lesson-status-options grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value: option, icon: Icon }) => (
          <label key={option} className="relative min-w-0 cursor-pointer">
            <input
              type="radio"
              name={id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
            />
            <span className="lesson-status-option flex min-h-12 h-full items-center gap-2 rounded-xl border border-line bg-paper/50 px-3 py-2 text-sm font-semibold text-muted peer-checked:border-bordeaux peer-checked:bg-bordeaux-soft peer-checked:text-bordeaux peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-bordeaux">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{t(`editor.lesson_status_${option}`)}</span>
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${value === option ? 'border-current bg-bordeaux text-surface' : 'border-muted/50'}`} aria-hidden="true">
                {value === option && <Check className="size-3" strokeWidth={3} />}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-muted">{t('editor.lesson_status_hint')}</p>
    </fieldset>
  )
}
