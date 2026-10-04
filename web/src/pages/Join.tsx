import { TranslatedMessage } from '../components/TranslatedMessage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../api'
import { LangToggle, Logo, ThemeToggle, Wordmark, PinPad } from '../components/shell'
import { Avatar, Badge, Button, EmptyState, ErrorBox, Field, inputClass, Spinner } from '../components/ui'
import { useMe } from '../queries'
import { rememberClass } from '../lib/recent'
import type { PublicClass } from '../types'

export default function Join() {
  const { code = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const me = useMe()
  const cls = useQuery({ queryKey: ['public', code], queryFn: () => api.get<PublicClass>(`/classes/${encodeURIComponent(code)}/public`) })
  const [selected, setSelected] = useState<number | null>(() => (params.get('m') ? Number(params.get('m')) : null))
  const [pin, setPin] = useState('')
  const [invite, setInvite] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [showPin1, setShowPin1] = useState(false)
  const [showPin2, setShowPin2] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (me.data?.kind === 'member' && me.data.classroom.code === code.toUpperCase()) navigate(`/c/${me.data.classroom.code}`, { replace: true })
  }, [me.data, code, navigate])

  const member = cls.data?.members.find((m) => m.id === selected)

  const done = async () => {
    if (member && cls.data) {
      rememberClass({ code: cls.data.code, label: cls.data.label, memberId: member.id, nick: member.nick, demo: cls.data.is_demo })
    }
    await qc.invalidateQueries()
    navigate(`/c/${cls.data?.code ?? code}`, { replace: true })
  }

  useEffect(() => {
    if (!cls.data?.is_demo || !member || member.needs_setup) return
    let cancel = false
    setBusy(true)
    setError(null)
    api.post(`/classes/${encodeURIComponent(code)}/demo-enter`, { member_id: member.id })
      .then(() => { if (!cancel) return done() })
      .catch((e) => { if (!cancel) setError((e as Error).message) })
      .finally(() => { if (!cancel) setBusy(false) })
    return () => { cancel = true }
    // Enter the demo nick without a PIN. `done` closes over the member selected above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.data?.is_demo, member?.id, code])

  const login = async (value: string) => {
    if (!member) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/classes/${encodeURIComponent(code)}/login`, { member_id: member.id, pin: value })
      await done()
    } catch (e) {
      setError((e as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const activate = async (e: FormEvent) => {
    e.preventDefault()
    if (!member) return
    if (pin1 !== pin2) {
      setError(t('join.pin_mismatch'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.post(`/classes/${encodeURIComponent(code)}/activate`, { member_id: member.id, invite, pin: pin1 })
      await done()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const back = () => {
    setSelected(null)
    setPin('')
    setError(null)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <Link to="/" aria-label="Home"><Wordmark /></Link>
            <Logo className="h-7" />
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 pb-16">
        {cls.isLoading && <Spinner />}
        {cls.error && <ErrorBox error={cls.error} />}
        {cls.data && me.data?.kind === 'member' && me.data.classroom.code !== cls.data.code && (
          <div className="mb-4 rounded-xl bg-giallo-soft p-3 text-sm">
            <span className="language-text">{t('join.wrong_class')}</span>{' '}
            <button className="font-semibold underline" onClick={async () => { await api.post('/auth/logout'); qc.invalidateQueries() }}>
              <span className="language-text">{t('join.switch')}</span>
            </button>
          </div>
        )}
        {cls.data && !member && (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight"><span className="language-text">{t('join.pick_title')}</span></h1>
            <p className="mt-1 text-muted"><TranslatedMessage message={'join.pick_sub'} values={{ name: cls.data.label }} /></p>
            {cls.data.members.length === 0 ? (
              <EmptyState title={t('join.no_members')} />
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cls.data.members.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setSelected(m.id)}
                      className="flex w-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 transition hover:border-bordeaux/40 hover:shadow-sm"
                    >
                      <Avatar nick={m.nick} color={m.color} size="lg" />
                      <span className="font-semibold">{m.nick}</span>
                      {m.needs_setup && <Badge className="bg-giallo-soft text-ink"><span className="language-text">{t('join.first_access')}</span></Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {member && (
          <div className="mx-auto max-w-sm">
            <button onClick={back} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
              <ArrowLeft className="size-4" /> <span className="language-text">{t('join.not_you')}</span>
            </button>
            <div className="mb-6 flex flex-col items-center text-center">
              <Avatar nick={member.nick} color={member.color} size="lg" />
              <h1 className="mt-3 text-2xl font-extrabold">
                <TranslatedMessage message={member.needs_setup ? 'join.setup_title' : 'join.pin_title'} values={{ nick: member.nick }} />
              </h1>
              <p className="mt-1 text-muted"><span className="language-text">{member.needs_setup ? t('join.setup_sub') : t('join.pin_sub')}</span></p>
            </div>
            {member.needs_setup ? (
              <form onSubmit={activate} className="space-y-4">
                <Field label={t('join.invite_label')}>
                  <input className={`${inputClass} font-mono uppercase tracking-widest`} placeholder="XXXX-XXXX" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="one-time-code" required />
                </Field>
                <Field label={t('join.new_pin')}>
                  <div className="relative">
                    <input className={`${inputClass} pr-11 tracking-[0.5em]`} type={showPin1 ? 'text' : 'password'} inputMode="numeric" maxLength={6} value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPin1((v) => !v)} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink" aria-label={t(showPin1 ? 'join.hide_pin' : 'join.show_pin')}>
                      {showPin1 ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <Field label={t('join.confirm_pin')}>
                  <div className="relative">
                    <input className={`${inputClass} pr-11 tracking-[0.5em]`} type={showPin2 ? 'text' : 'password'} inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPin2((v) => !v)} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink" aria-label={t(showPin2 ? 'join.hide_pin' : 'join.show_pin')}>
                      {showPin2 ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                {error && <p className="text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={pin1.length !== 6 || invite.length < 8}>
                  <span className="language-text">{t('join.enter')}</span>
                </Button>
              </form>
            ) : cls.data?.is_demo ? (
              <>
                <Spinner />
                {error && <p className="mt-4 text-center text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
              </>
            ) : (
              <>
                <PinPad value={pin} onChange={setPin} onSubmit={login} disabled={busy} />
                {error && <p className="mt-4 text-center text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
                <p className="mt-6 text-center text-xs text-muted"><span className="language-text">{t('join.forgot')}</span></p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
