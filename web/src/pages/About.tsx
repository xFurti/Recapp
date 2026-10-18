import { ArrowRight, Megaphone, MessageCircle, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CreatorSlideshow } from '../components/CreatorSlideshow'
import { FaqAccordion } from '../components/FaqAccordion'
import { PageIntro, PageReturn, SupportHeader } from '../components/SupportPage'
import { creators } from '../content/about'

export default function About() {
  const { t } = useTranslation()
  return (
    <div className="support-page min-h-dvh">
      <SupportHeader homeLabel={t('about.home')} />
      <main className="support-width support-main">
        <PageReturn to="/">{t('about.home')}</PageReturn>
        <PageIntro icon={MessageCircle} title={t('about.title')} description={<span className="language-text">{t('about.intro')}</span>} />
        <section aria-labelledby="faq-title" className="mt-7">
          <h2 id="faq-title" className="mb-4 flex items-center gap-2 support-section-title"><MessageCircle className="size-5 text-bordeaux" aria-hidden /><span className="language-text">{t('about.faq_title')}</span></h2>
          <FaqAccordion />
          <Link to="/segnala" state={{ from: '/faq' }} className="release-link mt-4 flex min-h-14 items-center gap-3 support-panel px-4 py-3 font-semibold hover:border-bordeaux/40">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bordeaux-soft text-bordeaux"><Megaphone className="size-4" aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="language-text">{t('report.menu')}</span></span>
            <ArrowRight className="size-4 text-muted" aria-hidden />
          </Link>
        </section>
        <section id="creators" aria-labelledby="creators-title" className="mt-10 scroll-mt-24">
          <h2 id="creators-title" className="mb-4 flex items-center gap-2 support-section-title"><Users className="size-5 text-bordeaux" aria-hidden /><span className="language-text">{t('about.creators_title')}</span></h2>
          <CreatorSlideshow profiles={creators} />
        </section>
      </main>
    </div>
  )
}
