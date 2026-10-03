import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { faqItems } from '../content/about'

export function FaqAccordion() {
  const { t } = useTranslation()
  const prefix = useId()
  const [active, setActive] = useState<string | null>(null)
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      {faqItems.map((item, index) => {
        const open = active === item.id
        const id = `${prefix}-${item.id}`
        return (
          <div key={item.id} className={index ? 'border-t border-line' : ''}>
            <h3>
              <button
                id={`${id}-question`}
                type="button"
                aria-expanded={open}
                aria-controls={`${id}-answer`}
                onClick={() => setActive(open ? null : item.id)}
                className="about-action flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold hover:bg-paper sm:px-6"
              >
                <span>{t(`about.faq.${item.id}.question`)}</span>
                <ChevronDown aria-hidden className={`faq-chevron size-5 shrink-0 text-bordeaux ${open ? 'rotate-180' : ''}`} />
              </button>
            </h3>
            <div id={`${id}-answer`} role="region" aria-labelledby={`${id}-question`} aria-hidden={!open} inert={!open} className="faq-answer" data-open={open}>
              <div className="min-h-0 overflow-hidden">
                <div className="px-5 pb-5 text-[15px] leading-relaxed text-muted [overflow-wrap:anywhere] sm:px-6">
                  <p>{t(`about.faq.${item.id}.answer`)}</p>
                  {'link' in item && (item.link.to.startsWith('#')
                    ? <a href={item.link.to} className="mt-3 inline-flex min-h-11 items-center font-semibold text-bordeaux underline underline-offset-4">{t(item.link.labelKey)}</a>
                    : <Link to={item.link.to} className="mt-3 inline-flex min-h-11 items-center font-semibold text-bordeaux underline underline-offset-4">{t(item.link.labelKey)}</Link>)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
