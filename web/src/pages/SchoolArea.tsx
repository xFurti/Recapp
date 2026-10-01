import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarOff, LogOut, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '../api'
import { InviteModal } from '../components/InviteModal'
import { LangToggle, Logo } from '../components/shell'
import { Badge, Button, Card, ErrorBox, Field, inputClass, Modal, Spinner } from '../components/ui'
import { capitalize, shortDay } from '../lib/format'
import { useMe } from '../queries'
import type { OwnerClass } from '../types'

export default function SchoolArea() {
  const { t } = useTranslation()
  const me = useMe()
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/"><Logo className="h-10" /></Link>
          <LangToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">
        {me.isLoading ? <Spinner /> : me.data?.kind === 'owner' ? <Dashboard name={me.data.owner.display_name || me.data.owner.username} /> : <OwnerLogin />}
      </main>
      <footer className="mx-auto max-w-4xl px-5 pb-8 text-xs text-muted">{t('landing.footer')}</footer>
    </div>
  )
}

function OwnerLogin() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: () => api.post('/owner/login', { username, password }),
    onSuccess: () => qc.invalidateQueries(),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-extrabold tracking-tight">{t('school.title')}</h1>
      <p className="mt-1 text-muted">{t('school.sub')}</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border border-line bg-white p-6">
        <Field label={t('school.username')}>
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label={t('school.password')}>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {login.error && <p className="text-sm font-medium text-rosa-ink" role="alert">{(login.error as Error).message}</p>}
        <Button type="submit" className="w-full" loading={login.isPending}>{t('school.login')}</Button>
      </form>
    </div>
  )
}

interface Created {
  code: string
  label: string
  admin: { member_id: number; nick: string; invite: string }
  join_url: string
}

function Dashboard({ name }: { name: string }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const classes = useQuery({ queryKey: ['owner-classes'], queryFn: () => api.get<OwnerClass[]>('/owner/classes') })
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const logout = async () => {
    await api.post('/auth/logout')
    qc.clear()
    qc.invalidateQueries()
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t('school.title')}</h1>
          <p className="mt-1 text-muted">{name} · {t('school.sub')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="size-4" /> {t('school.logout')}</Button>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('school.classes')}</h2>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> {t('school.create')}</Button>
        </div>
        {classes.isLoading && <Spinner />}
        {classes.error && <ErrorBox error={classes.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {classes.data?.map((c) => (
            <Card key={c.code} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold">{c.label}</p>
                  <p className="font-mono text-sm text-muted">{c.code}</p>
                </div>
                {c.is_demo && <Badge className="bg-viola-soft text-viola-ink">{t('school.demo_badge')}</Badge>}
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{c.last_published ? t('school.last_published', { day: capitalize(shortDay(c.last_published, i18n.language)) }) : t('school.never')}</li>
                <li>{t('school.week', { count: c.published_this_week })}</li>
                <li>{t('school.members', { active: c.members_active, total: c.members_total })}</li>
                {c.admins.length > 0 && <li className="text-muted">{t('school.admins', { list: c.admins.join(', ') })}</li>}
              </ul>
              <Link to={`/c/${c.code}`} className="mt-4 inline-flex items-center gap-1 self-start text-sm font-bold text-bordeaux hover:underline">
                {t('school.open')} <ArrowRight className="size-4" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <Holidays />

      <CreateClassModal
        open={creating}
        classes={classes.data ?? []}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false)
          setCreated(c)
          qc.invalidateQueries({ queryKey: ['owner-classes'] })
        }}
      />
      {created && (
        <InviteModal open onClose={() => setCreated(null)} nick={created.admin.nick} invite={created.admin.invite} joinUrl={created.join_url} classCode={created.code} />
      )}
    </div>
  )
}

function CreateClassModal({ open, classes, onClose, onCreated }: { open: boolean; classes: OwnerClass[]; onClose: () => void; onCreated: (c: Created) => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [adminNick, setAdminNick] = useState('rappresentante')
  const [from, setFrom] = useState('')
  const create = useMutation({
    mutationFn: () => api.post<Created>('/owner/classes', { name, label, admin_nick: adminNick, timetable_from: from || null }),
    onSuccess: (c) => {
      setName('')
      setLabel('')
      onCreated(c)
    },
  })
  return (
    <Modal open={open} onClose={onClose} title={t('school.create')}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-4">
        <Field label={t('school.name')}>
          <input className={`${inputClass} uppercase`} value={name} onChange={(e) => setName(e.target.value)} maxLength={10} required />
        </Field>
        <Field label={t('school.label')}>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="4ª CI · Informatica" maxLength={60} />
        </Field>
        <Field label={t('school.admin_nick')}>
          <input className={inputClass} value={adminNick} onChange={(e) => setAdminNick(e.target.value)} maxLength={16} required />
        </Field>
        <Field label={t('school.timetable_from')}>
          <select className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">{t('school.no_timetable')}</option>
            {classes.filter((c) => !c.is_demo).map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </Field>
        {create.error && <p className="text-sm font-medium text-rosa-ink">{(create.error as Error).message}</p>}
        <Button type="submit" className="w-full" loading={create.isPending}>{t('school.create')}</Button>
      </form>
    </Modal>
  )
}

function Holidays() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['holidays'], queryFn: () => api.get<{ day: string; label: string; kind: string }[]>('/owner/holidays') })
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<'festivita' | 'sospensione'>('sospensione')
  const refresh = () => qc.invalidateQueries({ predicate: (q) => ['holidays', 'rotation', 'today'].includes(String(q.queryKey[0])) })
  const add = useMutation({ mutationFn: () => api.post('/owner/holidays', { day, label, kind }), onSuccess: () => { setDay(''); setLabel(''); refresh() } })
  const del = useMutation({ mutationFn: (d: string) => api.del(`/owner/holidays/${d}`), onSuccess: refresh })
  return (
    <section>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-left" aria-expanded={open}>
        <span>
          <span className="flex items-center gap-2 font-bold"><CalendarOff className="size-5 text-azzurro-ink" /> {t('school.calendar')}</span>
          <span className="text-sm text-muted">{t('school.calendar_sub')}</span>
        </span>
        <span className="text-sm font-semibold text-muted">{list.data?.length ?? ''}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-line bg-white p-4">
          <form onSubmit={(e) => { e.preventDefault(); add.mutate() }} className="mb-4 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
            <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} required aria-label="Data" />
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('school.holiday_label')} required />
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as 'festivita' | 'sospensione')}>
              <option value="festivita">{t('school.kind_festivita')}</option>
              <option value="sospensione">{t('school.kind_sospensione')}</option>
            </select>
            <Button type="submit" loading={add.isPending}>{t('school.add_holiday')}</Button>
          </form>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {list.data?.map((h) => (
              <li key={h.day} className="flex items-center gap-3 py-2">
                <span className="w-28 shrink-0 font-semibold">{capitalize(shortDay(h.day, i18n.language))} {h.day.slice(0, 4)}</span>
                <span className="flex-1">{h.label}</span>
                <Badge className={h.kind === 'festivita' ? 'bg-rosa-soft text-rosa-ink' : 'bg-azzurro-soft text-azzurro-ink'}>{t(`school.kind_${h.kind}`)}</Badge>
                <button onClick={() => del.mutate(h.day)} className="rounded-full p-1.5 text-muted hover:bg-rosa-soft hover:text-rosa-ink" aria-label={t('common.delete')}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
