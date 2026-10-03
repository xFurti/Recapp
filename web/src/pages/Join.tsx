import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
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
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
        <Link to="/" aria-label="Home">
          <span className="flex items-center gap-2"><Wordmark /><Logo className="h-7" /></span>
        </Link>
        <ThemeToggle />
            <LangToggle />
      </header>
      <main className="mx-auto max-w-xl px-5 pb-16">
        {cls.isLoading && <Spinner />}
        {cls.error && <ErrorBox error={cls.error} />}
        {cls.data && me.data?.kind === 'member' && me.data.classroom.code !== cls.data.code && (
          <div className="mb-4 rounded-xl bg-giallo-soft p-3 text-sm">
            {t('join.wrong_class')}{' '}
            <button className="font-semibold underline" onClick={async () => { await api.post('/auth/logout'); qc.invalidateQueries() }}>
              {t('join.switch')}
            </button>
          </div>
        )}
        {cls.data && !member && (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight">{t('join.pick_title')}</h1>
            <p className="mt-1 text-muted">{t('join.pick_sub', { name: cls.data.label })}</p>
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
                      {m.needs_setup && <Badge className="bg-giallo-soft text-ink">{t('join.first_access')}</Badge>}
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
              <ArrowLeft className="size-4" /> {t('join.not_you')}
            </button>
            <div className="mb-6 flex flex-col items-center text-center">
              <Avatar nick={member.nick} color={member.color} size="lg" />
              <h1 className="mt-3 text-2xl font-extrabold">
                {member.needs_setup ? t('join.setup_title', { nick: member.nick }) : t('join.pin_title', { nick: member.nick })}
              </h1>
              <p className="mt-1 text-muted">{member.needs_setup ? t('join.setup_sub') : t('join.pin_sub')}</p>
            </div>
            {member.needs_setup ? (
              <form onSubmit={activate} className="space-y-4">
                <Field label={t('join.invite_label')}>
                  <input className={`${inputClass} font-mono uppercase tracking-widest`} placeholder="XXXX-XXXX" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="one-time-code" required />
                </Field>
                <Field label={t('join.new_pin')}>
                  <input className={`${inputClass} tracking-[0.5em]`} type="password" inputMode="numeric" maxLength={6} value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" required />
                </Field>
                <Field label={t('join.confirm_pin')}>
                  <input className={`${inputClass} tracking-[0.5em]`} type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} autoComplete="new-password" required />
                </Field>
                {error && <p className="text-sm font-medium text-rosa-ink" role="alert">{error}</p>}
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={pin1.length !== 6 || invite.length < 8}>
                  {t('join.enter')}
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
                <p className="mt-6 text-center text-xs text-muted">{t('join.forgot')}</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
