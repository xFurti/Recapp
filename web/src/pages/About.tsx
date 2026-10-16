import { ArrowLeft, ArrowRight, Megaphone, MessageCircle, Users } from 'lucide-react'
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
        <div className="flex items-center gap-3">
          <Link to="/" aria-label={t('about.home')}><Wordmark /></Link>
          <Logo className="h-8" />
        </div>
        <div className="flex items-center gap-2"><ThemeToggle /><LangToggle /></div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <Link to="/" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /><span className="language-text">{t('about.home')}</span></Link>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl"><span className="language-text">{t('about.title')}</span></h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted"><span className="language-text">{t('about.intro')}</span></p>
        <section aria-labelledby="faq-title" className="mt-9">
          <h2 id="faq-title" className="mb-4 flex items-center gap-2 text-xl font-bold"><MessageCircle className="size-5 text-bordeaux" aria-hidden /><span className="language-text">{t('about.faq_title')}</span></h2>
          <FaqAccordion />
          <Link to="/segnala" state={{ from: '/faq' }} className="release-link mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 font-semibold hover:border-bordeaux/40">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bordeaux-soft text-bordeaux"><Megaphone className="size-4" aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="language-text">{t('report.menu')}</span></span>
            <ArrowRight className="size-4 text-muted" aria-hidden />
          </Link>
        </section>
        <section id="creators" aria-labelledby="creators-title" className="mt-10 scroll-mt-5">
          <h2 id="creators-title" className="mb-4 flex items-center gap-2 text-xl font-bold"><Users className="size-5 text-bordeaux" aria-hidden /><span className="language-text">{t('about.creators_title')}</span></h2>
          <CreatorSlideshow profiles={creators} />
        </section>
      </main>
    </div>
  )
}
