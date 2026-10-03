import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, History, School, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { api, ApiError } from '../api'
import { LangToggle, Logo, ThemeToggle, Wordmark } from '../components/shell'
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
      rememberClass({ code: res.code, label: res.label, memberId: res.member_id, nick: res.nick })
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
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
        <Logo className="h-10" />
        <div className="flex items-center gap-2">
          <Link to="/scuola" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:text-ink">
            <School className="size-4" /> {t('landing.school')}
          </Link>
          <ThemeToggle />
            <LangToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 pb-10 pt-4 md:grid-cols-[1.1fr_1fr]">
        <section>
          <div className="mb-6"><Wordmark size="lg" /></div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{t('landing.title')}</h1>
          <p className="mt-4 max-w-lg text-lg text-muted">{t('landing.subtitle')}</p>
          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="size-5" />
                </span>
                <div>
                  <p className="font-bold">{f.title}</p>
                  <p className="text-sm text-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          {current && (
            <Button className="mb-6 w-full" size="lg" onClick={() => navigate(`/c/${current.code}`)}>
              {t('landing.continue', { name: current.label })} <ArrowRight className="size-4" />
            </Button>
          )}
          {!current && recent && (
            <Button className="mb-6 w-full" size="lg" onClick={() => navigate(`/c/${recent.code}/entra?m=${recent.memberId}`)}>
              {t('landing.rejoin', { name: recent.label })} <ArrowRight className="size-4" />
            </Button>
          )}
          <form onSubmit={enter}>
            <label htmlFor="class-code" className="mb-1.5 block text-sm font-semibold">
              {t('landing.code_label')}
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
                {t('landing.enter')}
              </Button>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
          </div>

          <Button variant="soft" size="lg" className="w-full" onClick={demo} loading={busy === 'demo'}>
            {t('landing.demo')}
          </Button>
          <p className="mt-2 text-center text-sm text-muted">{t('landing.demo_hint')}</p>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-muted">
          <span>{t('landing.footer')}</span>
          <Link to="/privacy" className="font-semibold underline">
            {t('landing.privacy')}
          </Link>
        </div>
      </footer>
    </div>
  )
}
