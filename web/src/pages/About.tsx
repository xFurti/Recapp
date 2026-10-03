import { ArrowLeft, MessageCircle, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CreatorSlideshow } from '../components/CreatorSlideshow'
import { FaqAccordion } from '../components/FaqAccordion'
import { LangToggle, Logo, ThemeToggle, Wordmark } from '../components/shell'
import { creators } from '../content/about'

export default function About() {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link to="/" aria-label={t('about.home')} className="flex items-center gap-3"><Wordmark /><Logo className="h-8" /></Link>
        <div className="flex items-center gap-2"><ThemeToggle /><LangToggle /></div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <Link to="/" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{t('about.home')}</Link>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('about.title')}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">{t('about.intro')}</p>
        <section aria-labelledby="faq-title" className="mt-9">
          <h2 id="faq-title" className="mb-4 flex items-center gap-2 text-xl font-bold"><MessageCircle className="size-5 text-bordeaux" aria-hidden />{t('about.faq_title')}</h2>
          <FaqAccordion />
        </section>
        <section id="creators" aria-labelledby="creators-title" className="mt-10 scroll-mt-5">
          <h2 id="creators-title" className="mb-4 flex items-center gap-2 text-xl font-bold"><Users className="size-5 text-bordeaux" aria-hidden />{t('about.creators_title')}</h2>
          <CreatorSlideshow profiles={creators} />
        </section>
      </main>
    </div>
  )
}
