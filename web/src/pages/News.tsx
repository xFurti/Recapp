import { ArrowLeft, ArrowUpRight, Check, Sparkles, Wrench } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { LangToggle, Logo, ThemeToggle, Wordmark } from '../components/shell'
import { Button, Spinner } from '../components/ui'
import { appVersion, demoReleaseAccount, localized, officialReleaseAccount, rememberRelease, useReleases } from '../lib/releases'
import { useMe } from '../queries'

const categories = [
  { name: 'feature', icon: Sparkles, tone: 'bg-bordeaux-soft text-bordeaux' },
  { name: 'improvement', icon: Wrench, tone: 'bg-azzurro-soft text-azzurro-ink' },
  { name: 'fix', icon: Check, tone: 'bg-verde-soft text-verde-ink' },
] as const

export default function News() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const notes = useReleases()
  const me = useMe()
  useEffect(() => {
    if (!notes.data?.current || (appVersion !== 'dev' && notes.data.version !== appVersion)) return
    const who = me.data
    const account = who?.kind === 'member'
      ? (who.classroom.is_demo ? demoReleaseAccount : officialReleaseAccount('member', who.member.id))
      : who?.kind === 'owner' ? officialReleaseAccount('owner', who.owner.username) : null
    if (account) rememberRelease(account, notes.data.current).catch(() => undefined)
  }, [notes.data, me.data])
  useEffect(() => {
    if (!notes.data || !location.hash) return
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' })
  }, [notes.data, location.hash])
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <Link to="/" aria-label={t('common.app_name')}><Wordmark /></Link><Logo className="h-7 sm:h-8" />
          </span>
          <div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /><LangToggle /></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-5">
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /><span className="language-text">{t('common.back')}</span>
        </button>
        <div className="mb-8">
          <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-bordeaux-soft text-bordeaux"><Sparkles className="size-6" aria-hidden /></span>
          <h1 className="text-4xl font-extrabold tracking-tight"><span className="language-text">{t('news.title')}</span></h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted"><span className="language-text">{t('news.intro')}</span></p>
        </div>
        {notes.isLoading && <Spinner />}
        {notes.isError && <div role="status" className="rounded-2xl border border-line bg-surface p-5">
          <p><span className="language-text">{t('news.error')}</span></p>
          <Button variant="secondary" className="mt-4" onClick={() => notes.refetch()}><span className="language-text">{t('common.retry')}</span></Button>
        </div>}
        {notes.data && !notes.data.releases.length && <p className="text-muted"><span className="language-text">{t('news.empty')}</span></p>}
        <div className="space-y-8">
          {notes.data?.releases.map((release) => <article key={release.id} id={`release-${release.id}`} className="scroll-mt-24 rounded-3xl border border-line bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-muted">
              <time dateTime={release.published_at}><span className="language-text">{new Intl.DateTimeFormat(i18n.language.startsWith('it') ? 'it-IT' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(release.published_at))}</span></time>
              <span className="rounded-full bg-paper px-2.5 py-1">v{release.id}</span>
              {release.id === notes.data.current && <span className="rounded-full bg-verde-soft px-2.5 py-1 text-verde-ink"><span className="language-text">{t('news.latest')}</span></span>}
            </div>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight"><span className="language-text">{localized(release.title, i18n.language)}</span></h2>
            {categories.map((category) => {
              const entries = release.entries.filter((entry) => entry.category === category.name)
              return entries.length > 0 && <section key={category.name} className="mt-6 border-t border-line pt-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <span className={`flex size-8 items-center justify-center rounded-lg ${category.tone}`}><category.icon className="size-4" aria-hidden /></span>
                  <span className="language-text">{t(`news.${category.name}`)}</span>
                </h3>
                <ul className="mt-4 space-y-5">
                  {entries.map((entry, index) => <li key={index} className="min-w-0">
                    <h4 className="font-bold"><span className="language-text">{localized(entry.title, i18n.language)}</span></h4>
                    <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-muted"><span className="language-text">{localized(entry.body, i18n.language)}</span></p>
                    {entry.image && <img src={entry.image.src} alt={localized(entry.image.alt, i18n.language)} loading="lazy" className="mt-4 w-full rounded-xl border border-line" />}
                    {entry.link && <div className="mt-3">
                      {entry.link.href.startsWith('/') ? <Link to={entry.link.href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-bordeaux hover:underline">
                        <span className="language-text">{localized(entry.link.label, i18n.language)}</span><ArrowUpRight className="size-4" aria-hidden />
                      </Link> : <a href={entry.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-bordeaux hover:underline">
                        <span className="language-text">{localized(entry.link.label, i18n.language)}</span><ArrowUpRight className="size-4" aria-hidden />
                      </a>}
                      {entry.link.requires_login && <span className="ml-2 text-xs text-muted"><span className="language-text">{t('news.login_required')}</span></span>}
                    </div>}
                  </li>)}
                </ul>
              </section>
            })}
          </article>)}
        </div>
        <p className="mt-8 text-sm text-muted"><span className="language-text">{t('news.footer')}</span></p>
      </main>
    </div>
  )
}
