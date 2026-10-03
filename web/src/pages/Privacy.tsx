import { ArrowLeft, Ban, CalendarX, Database, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { LangToggle, Logo, ThemeToggle, Wordmark } from '../components/shell'

export default function Privacy() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const sections = [
    { icon: Database, title: t('privacy.save_title'), items: [t('privacy.save_1'), t('privacy.save_2'), t('privacy.save_3')], tone: 'text-azzurro-ink bg-azzurro-soft' },
    { icon: Ban, title: t('privacy.not_title'), items: [t('privacy.not_1'), t('privacy.not_2'), t('privacy.not_3')], tone: 'text-rosa-ink bg-rosa-soft' },
    { icon: Eye, title: t('privacy.who_title'), items: [t('privacy.who_1'), t('privacy.who_2')], tone: 'text-viola-ink bg-viola-soft' },
    { icon: CalendarX, title: t('privacy.end_title'), items: [t('privacy.end_1')], tone: 'text-verde-ink bg-verde-soft' },
  ]
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2"><Wordmark /><Logo className="h-7 sm:h-8" /></Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {t('common.back')}
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('privacy.title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('privacy.intro')}</p>
        <div className="mt-8 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className={`flex size-9 items-center justify-center rounded-xl ${s.tone}`}><s.icon className="size-5" /></span>
                {s.title}
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6">
                {s.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">{t('privacy.contact')}</p>
      </main>
    </div>
  )
}
