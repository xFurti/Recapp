import { TranslatedMessage } from '../components/TranslatedMessage'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, History, School, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api, ApiError } from '../api'
import { LangToggle, RECAPP_MARK_MS, SchoolBadge, ThemeToggle, Wordmark } from '../components/shell'
import { useNavIconMotion } from '../components/NavIcon'
import { Button, inputClass } from '../components/ui'
import { useMe } from '../queries'
import { getRecent, rememberClass } from '../lib/recent'

export default function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useMe()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'enter' | 'demo' | null>(null)
  const hero = useNavIconMotion(RECAPP_MARK_MS)
  useEffect(() => {
    const id = window.setTimeout(() => hero.play(), 350)
    return () => window.clearTimeout(id)
  }, [hero.play])

  const enter = async (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) return
    setBusy('enter')
    setError(null)
    try {
      await api.get(`/classes/${encodeURIComponent(clean)}/public`)
      navigate(`/c/${clean}/entra`)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? t('landing.not_found') : (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const demo = async () => {
    setBusy('demo')
    try {
      const res = await api.post<{ code: string; label: string; member_id: number; nick: string }>('/auth/demo/mine')
      rememberClass({ code: res.code, label: res.label, memberId: res.member_id, nick: res.nick, demo: true })
      await qc.invalidateQueries()
      navigate(`/c/${res.code}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  const current = me.data?.kind === 'member' ? me.data.classroom : null
  const recent = current ? null : getRecent()

  const features = [
    { icon: History, title: t('landing.f1_title'), text: t('landing.f1_text'), color: 'text-bordeaux bg-bordeaux-soft' },
    { icon: CalendarClock, title: t('landing.f2_title'), text: t('landing.f2_text'), color: 'text-azzurro-ink bg-azzurro-soft' },
    { icon: Users, title: t('landing.f3_title'), text: t('landing.f3_text'), color: 'text-verde-ink bg-verde-soft' },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:py-3.5">
          <SchoolBadge />
          <div className="flex items-center gap-1.5">
            <Link to="/scuola" aria-label={t('landing.school')} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-muted hover:text-ink">
              <School className="size-4" />
              <span className="hidden sm:inline"><span className="language-text">{t('landing.school')}</span></span>
            </Link>
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 px-5 pb-10 pt-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-10">
        {/* `contents` on the phone so the join card can sit between the title and the feature list. */}
        <div className="contents md:block">
          <section>
            <div className="mb-5" {...hero.triggers}><Wordmark size="lg" playing={hero.playing} /></div>
            <h1 className="text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl"><span className="language-text">{t('landing.title')}</span></h1>
            <p className="mt-3 max-w-lg text-base text-muted sm:mt-4 sm:text-lg"><span className="language-text">{t('landing.subtitle')}</span></p>
          </section>
          <ul className="order-2 space-y-4 md:order-none md:mt-8">
            {features.map((f, index) => (
              <li key={index} className="flex gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="size-5" />
                </span>
                <div>
                  <p className="language-text font-bold">{f.title}</p>
                  <p className="text-sm text-muted"><span className="language-text">{f.text}</span></p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <section className="order-1 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8 md:order-none">
          {current && (
            <Button className="mb-6 w-full" size="lg" onClick={() => navigate(`/c/${current.code}`)}>
              <TranslatedMessage message={'landing.continue'} values={{ name: current.label }} /> <ArrowRight className="size-4" />
            </Button>
          )}
          {!current && recent && (
            <Button className="mb-6 w-full" size="lg" onClick={() => (recent.demo ? demo() : navigate(`/c/${recent.code}/entra?m=${recent.memberId}`))} loading={recent.demo && busy === 'demo'}>
              <TranslatedMessage message={'landing.rejoin'} values={{ name: recent.label }} /> <ArrowRight className="size-4" />
            </Button>
          )}
          <form onSubmit={enter}>
            <label htmlFor="class-code" className="mb-1.5 block text-sm font-semibold">
              <span className="language-text">{t('landing.code_label')}</span>
            </label>
            <div className="flex gap-2">
              <input
                id="class-code"
                className={`${inputClass} font-mono uppercase tracking-wider`}
                placeholder={t('landing.code_placeholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <Button type="submit" loading={busy === 'enter'}>
                <span className="language-text">{t('landing.enter')}</span>
              </Button>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
          </div>

          <Button variant="soft" size="lg" className="w-full" onClick={demo} loading={busy === 'demo'}>
            <span className="language-text">{t('landing.demo')}</span>
          </Button>
          <p className="mt-2 text-center text-sm text-muted"><span className="language-text">{t('landing.demo_hint')}</span></p>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/60 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-muted">
          <span><span className="language-text">{t('landing.footer')}</span></span>
          <nav aria-label={t('landing.info_links')} className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold underline"><span className="language-text">{t('landing.privacy')}</span></Link>
            <Link to="/faq" className="inline-flex min-h-11 items-center font-semibold underline"><span className="language-text">{t('about.title')}</span></Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
