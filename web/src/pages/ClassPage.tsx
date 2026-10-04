import { TranslatedMessage } from '../components/TranslatedMessage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeftRight, ArrowUp, Crown, ImagePlus, KeyRound, Lock, MoreVertical, Pencil, UserMinus, UserPlus } from 'lucide-react'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { api } from '../api'
import { ClassBoard } from '../components/ClassBoard'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { InviteModal } from '../components/InviteModal'
import { DayView, WeekGrid } from '../components/timetable'
import { AnchoredMenu, Avatar, Badge, Button, Card, EmptyState, ErrorBox, Field, inputClass, Modal, Segmented, Spinner } from '../components/ui'
import { todayIso } from '../lib/clock'
import { capitalize, shortDay, subjectName } from '../lib/format'
import { timetableModel, useSchoolClock, weekdayName, type Slot } from '../lib/timetable'
import { classPath, useClass, useToday } from '../queries'
import type { HourSlot, Invite, MemberBrief, MemberRow, RotationDay, TimetableData } from '../types'
import { DemoWeekendNote, isWeekend } from './Today'

type Tab = 'members' | 'turns' | 'timetable'

export default function ClassPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'members'
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight"><span className="language-text">{t('nav.class')}</span></h1>
      <ClassBoard />
      <Segmented
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        options={[
          { value: 'members', label: t('class.tab_members') },
          { value: 'turns', label: t('class.tab_turns') },
          { value: 'timetable', label: t('class.tab_timetable') },
        ]}
      />
      <div className="mt-5">
        {tab === 'members' && <Members />}
        {tab === 'turns' && <Turns />}
        {tab === 'timetable' && <Timetable />}
      </div>
    </div>
  )
}

// ---- members ---------------------------------------------------------------------
function Members() {
  const info = useClass()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['members', info.code], queryFn: () => api.get<{ members: MemberRow[]; can_manage: boolean }>(classPath(info.code, '/members')) })
  const [adding, setAdding] = useState(false)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [menu, setMenu] = useState<{ id: number; el: HTMLButtonElement } | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'reset' | 'remove'; member: MemberRow } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const refresh = () => qc.invalidateQueries({ predicate: (q) => ['members', 'rotation', 'today', 'public'].includes(String(q.queryKey[0])) })
  const act = useMutation({
    mutationFn: async ({ kind, m }: { kind: 'reset' | 'admin' | 'member' | 'remove'; m: MemberRow }) => {
      if (kind === 'reset') return api.post<Invite>(classPath(info.code, `/members/${m.id}/reset-invite`))
      if (kind === 'remove') return api.del(classPath(info.code, `/members/${m.id}`))
      return api.patch(classPath(info.code, `/members/${m.id}`), { role: kind })
    },
    onSuccess: (data, { kind }) => {
      closeMenu()
      if (kind === 'reset') setInvite(data as Invite)
      refresh()
    },
  })

  if (list.isLoading) return <Spinner />
  if (list.error) return <ErrorBox error={list.error} onRetry={() => list.refetch()} />
  const { members, can_manage } = list.data!
  const openMember = menu ? members.find((m) => m.id === menu.id) : undefined

  const confirmAct = (kind: 'reset' | 'admin' | 'member' | 'remove', m: MemberRow) => {
    closeMenu()
    if (kind === 'reset' || kind === 'remove') {
      setConfirm({ kind, member: m })
      return
    }
    act.mutate({ kind, m })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted"><span className="language-text">{t('class.members_count', { count: members.length })}</span></p>
        {can_manage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> <span className="language-text">{t('class.add')}</span>
          </Button>
        )}
      </div>
      {act.error && <div className="mb-3"><ErrorBox error={act.error} /></div>}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {members.map((m) => (
          <li key={m.id} className="relative flex items-center gap-3 px-4 py-3">
            <Avatar nick={m.nick} color={m.color} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                {m.nick}
                {m.is_me && <span className="text-xs font-medium text-muted">(<span className="language-text">{t('common.you')}</span>)</span>}
                {m.role === 'admin' && <Badge className="bg-bordeaux-soft text-bordeaux"><Crown className="size-3" /> <span className="language-text">{t('class.admin')}</span></Badge>}
                {m.is_today_scribe && <Badge className="bg-giallo text-[#1d1b1e]"><Pencil className="size-3" /> <span className="language-text">{t('class.scribe_today')}</span></Badge>}
                {!m.activated && <Badge className="bg-ink/5 text-muted"><span className="language-text">{t('class.not_activated')}</span></Badge>}
              </p>
              <p className="text-xs text-muted">
                <span className="language-text">{t('class.days_written', { count: m.days_written })}</span> · <span className="language-text">{t('class.items_added', { count: m.items_added })}</span>
              </p>
            </div>
            {can_manage && (
              <button
                type="button"
                onClick={(e) => {
                  const el = e.currentTarget
                  setMenu((cur) => (cur?.id === m.id ? null : { id: m.id, el }))
                }}
                className="rounded-full p-2 hover:bg-ink/5"
                aria-label={t('class.manage')}
                aria-haspopup="menu"
                aria-expanded={menu?.id === m.id}
              >
                <MoreVertical className="size-5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {openMember && menu && (
        <AnchoredMenu open anchorEl={menu.el} onClose={closeMenu}>
          <MenuItem icon={KeyRound} label={t('class.reset')} hint={t('class.reset_help')} onClick={() => confirmAct('reset', openMember)} />
          {info.is_demo ? (
            <p className="px-3 py-2 text-xs text-muted"><span className="language-text">{t('class.demo_locked')}</span></p>
          ) : openMember.role === 'member' ? (
            <MenuItem icon={Crown} label={t('class.make_admin')} onClick={() => confirmAct('admin', openMember)} />
          ) : (
            <MenuItem icon={Crown} label={t('class.make_member')} onClick={() => confirmAct('member', openMember)} />
          )}
          {!openMember.is_me && !info.is_demo && <MenuItem icon={UserMinus} label={t('class.remove')} danger onClick={() => confirmAct('remove', openMember)} />}
        </AnchoredMenu>
      )}
      <AddMemberModal open={adding} onClose={() => setAdding(false)} onCreated={(inv) => { setAdding(false); setInvite(inv); refresh() }} />
      {invite && (
        <InviteModal open onClose={() => setInvite(null)} nick={invite.nick} invite={invite.invite} joinUrl={invite.join_url} classCode={info.code} />
      )}
      {confirm && (
        <ConfirmationDialog
          title={t(confirm.kind === 'remove' ? 'class.remove_title' : 'class.reset_title', { nick: confirm.member.nick })}
          description={t(confirm.kind === 'remove' ? 'class.remove_body' : 'class.reset_body')}
          confirmLabel={t(confirm.kind === 'remove' ? 'class.remove_action' : 'class.reset_action')}
          pendingLabel={t(confirm.kind === 'remove' ? 'class.remove_pending' : 'class.reset_pending')}
          errorLabel={t(confirm.kind === 'remove' ? 'class.remove_error' : 'class.reset_error')}
          confirmVariant={confirm.kind === 'remove' ? 'danger' : 'primary'}
          icon={confirm.kind === 'remove' ? <UserMinus className="size-6" aria-hidden /> : <KeyRound className="size-6" aria-hidden />}
          iconClassName={confirm.kind === 'remove' ? 'bg-rosa-soft text-rosa-ink' : 'bg-bordeaux-soft text-bordeaux'}
          onConfirm={() => act.mutateAsync({ kind: confirm.kind, m: confirm.member })}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, hint, onClick, danger }: { icon: typeof Crown; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm ${danger ? 'text-rosa-ink hover:bg-rosa-soft' : 'hover:bg-ink/5'}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="language-text block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  )
}

function AddMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (i: Invite) => void }) {
  const info = useClass()
  const { t } = useTranslation()
  const [nick, setNick] = useState('')
  const [admin, setAdmin] = useState(false)
  const add = useMutation({
    mutationFn: () => api.post<Invite>(classPath(info.code, '/members'), { nick, role: admin ? 'admin' : 'member' }),
    onSuccess: (inv) => {
      setNick('')
      setAdmin(false)
      onCreated(inv)
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    add.mutate()
  }
  return (
    <Modal open={open} onClose={onClose} title={t('class.add')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('class.nick_label')}>
          <input className={inputClass} value={nick} onChange={(e) => setNick(e.target.value)} placeholder={t('class.nick_ph')} maxLength={16} required autoFocus />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-bordeaux" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          <span className="language-text">{t('class.as_admin')}</span>
        </label>
        {add.error && <p className="text-sm font-medium text-rosa-ink">{(add.error as Error).message}</p>}
        <Button type="submit" className="w-full" loading={add.isPending} disabled={nick.trim().length < 2}>
          <span className="language-text">{t('class.add_btn')}</span>
        </Button>
      </form>
    </Modal>
  )
}

// ---- turns -------------------------------------------------------------------------
function Turns() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const rot = useQuery({
    queryKey: ['rotation', info.code],
    queryFn: () => api.get<{ days: RotationDay[]; order: MemberBrief[]; not_activated: MemberBrief[] }>(classPath(info.code, '/rotation?days=10')),
  })
  const [swapMode, setSwapMode] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ predicate: (q) => ['rotation', 'today', 'members'].includes(String(q.queryKey[0])) })
  const swap = useMutation({
    mutationFn: (days: [string, string]) => api.post(classPath(info.code, '/rotation/swap'), { day_a: days[0], day_b: days[1] }),
    onSuccess: () => {
      setPicked(null)
      setSwapMode(false)
      setMsg(t('class.swap_done'))
      refresh()
    },
  })
  const order = useMutation({
    mutationFn: (ids: number[]) => api.patch(classPath(info.code, '/rotation/order'), { member_ids: ids }),
    onSuccess: refresh,
  })

  if (rot.isLoading) return <Spinner />
  if (rot.error) return <ErrorBox error={rot.error} onRetry={() => rot.refetch()} />
  const data = rot.data!
  const today = todayIso()
  const todayRow = data.days.find((d) => d.day === today && d.school)
  const manage = info.viewer.can_manage
  const canReorder = manage && !info.is_demo

  const pick = (day: string) => {
    if (!swapMode) return
    if (!picked) setPicked(day)
    else if (picked === day) setPicked(null)
    else swap.mutate([picked, day])
  }

  const move = (idx: number, dir: -1 | 1) => {
    const ids = data.order.map((m) => m.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    order.mutate(ids)
  }

  return (
    <div className="space-y-6">
      {info.is_demo && data.days.some((d) => isWeekend(d.day)) && <DemoWeekendNote />}
      <Card className="flex items-center gap-3">
        {todayRow?.scribe ? <Avatar nick={todayRow.scribe.nick} color={todayRow.scribe.color} size="lg" /> : null}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('class.turns_today')}</span></p>
          <p className="text-xl font-extrabold">{todayRow?.scribe?.nick ?? t('class.turns_nobody')}</p>
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('class.turns_next')}</span></h2>
          {manage && (
            <Button size="sm" variant={swapMode ? 'primary' : 'secondary'} onClick={() => { setSwapMode((s) => !s); setPicked(null); setMsg(null) }}>
              <ArrowLeftRight className="size-4" /> <span className="language-text">{t('class.swap')}</span>
            </Button>
          )}
        </div>
        {swapMode && <p className="mb-2 text-sm text-muted"><span className="language-text">{t('class.swap_help')}</span></p>}
        {msg && <p className="mb-2 text-sm font-semibold text-verde-ink">{msg}</p>}
        {swap.error && <p className="mb-2 text-sm font-medium text-rosa-ink">{(swap.error as Error).message}</p>}
        <ol className="space-y-1.5">
          {data.days.map((d) =>
            d.school ? (
              <li key={d.day}>
                <button
                  onClick={() => pick(d.day)}
                  disabled={!swapMode}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    picked === d.day ? 'border-bordeaux ring-2 ring-bordeaux/30' : 'border-line'
                  } ${swapMode ? 'hover:border-ink/40' : ''} ${d.day === today ? 'bg-giallo-soft' : 'bg-surface'}`}
                >
                  <span className="w-24 shrink-0 text-sm font-semibold">{capitalize(shortDay(d.day, i18n.language))}</span>
                  {d.scribe ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar nick={d.scribe.nick} color={d.scribe.color} size="sm" />
                      <span className="truncate font-semibold">{d.scribe.nick}</span>
                    </span>
                  ) : (
                    <span className="flex-1 text-sm text-muted"><span className="language-text">{t('class.turns_nobody')}</span></span>
                  )}
                  {d.override_reason && <Badge className="bg-ink/5 text-muted"><span className="language-text">{t(`class.ov_${d.override_reason}`)}</span></Badge>}
                  {d.card_status && (
                    <Badge className={d.card_status === 'published' ? 'bg-verde-soft text-verde-ink' : 'bg-giallo-soft text-ink'}>
                      <span className="language-text">{t(`class.st_${d.card_status}`)}</span>
                    </Badge>
                  )}
                </button>
              </li>
            ) : (
              <li key={d.day} className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-muted">
                <span className="w-24 shrink-0">{capitalize(shortDay(d.day, i18n.language))}</span>
                <span className="italic"><TranslatedMessage message={'class.turns_skipped'} values={{ reason: d.reason }} /></span>
              </li>
            ),
          )}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted"><span className="language-text">{t('class.turns_order')}</span></h2>
        <p className="mb-2 text-sm text-muted"><span className="language-text">{t('class.turns_order_help')}</span></p>
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {data.order.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-center text-sm font-bold text-muted">{i + 1}</span>
              <Avatar nick={m.nick} color={m.color} size="sm" />
              <span className="flex-1 font-semibold">{m.nick}</span>
              {canReorder && (
                <>
                  <button onClick={() => move(i, -1)} disabled={i === 0 || order.isPending} className="rounded-full p-1.5 hover:bg-ink/5 disabled:opacity-30" aria-label={t('class.move_up')}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === data.order.length - 1 || order.isPending} className="rounded-full p-1.5 hover:bg-ink/5 disabled:opacity-30" aria-label={t('class.move_down')}>
                    <ArrowDown className="size-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
        {data.not_activated.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            <span className="language-text">{t('class.turns_pending')}</span>: {data.not_activated.map((m) => m.nick).join(', ')}
          </p>
        )}
      </section>
    </div>
  )
}

// ---- timetable ---------------------------------------------------------------------
const ZONES = ['Europe/Rome', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/London', 'UTC']

function Timetable() {
  const info = useClass()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const qc = useQueryClient()
  const tt = useQuery({ queryKey: ['timetable', info.code], queryFn: () => api.get<TimetableData>(classPath(info.code, '/timetable')) })
  const [editing, setEditing] = useState<Slot[] | null>(null)
  const [hours, setHours] = useState<HourSlot[] | null>(null)
  const [timezone, setTimezone] = useState('Europe/Rome')
  const [cell, setCell] = useState<{ weekday: number; hour: number } | null>(null)
  const [saved, setSaved] = useState(false)
  const [reading, setReading] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [unplaced, setUnplaced] = useState<{ raw_subject: string; reason: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const cancelRead = useRef(false)
  // A phone shows one day at a time; wider screens get the whole week.
  const [view, setView] = useState<'day' | 'week'>(() => (window.matchMedia('(min-width: 768px)').matches ? 'week' : 'day'))
  const today = useToday(info.code)
  const clock = useSchoolClock(today.data, today.dataUpdatedAt, tt.data?.timezone ?? 'Europe/Rome')
  const save = useMutation({
    mutationFn: (body: { slots: Slot[]; hours: HourSlot[]; timezone: string }) =>
      api.put(classPath(info.code, '/timetable'), {
        slots: body.slots.map(({ weekday, hour, subject_code, room }) => ({ weekday, hour, subject_code, room })),
        hours: body.hours,
        timezone: body.timezone,
      }),
    onSuccess: () => {
      setEditing(null)
      setHours(null)
      setNotes({})
      setUnplaced([])
      setSaved(true)
      qc.invalidateQueries({ predicate: (q) => ['timetable', 'today', 'card'].includes(String(q.queryKey[0])) })
    },
  })
  if (tt.isLoading) return <Spinner />
  if (tt.error) return <ErrorBox error={tt.error} onRetry={() => tt.refetch()} />
  const data = tt.data!
  const slots = editing ?? data.slots
  const rows = hours ?? data.hours
  const at = (w: number, h: number) => slots.find((s) => s.weekday === w && s.hour === h)
  const hasAny = slots.length > 0
  const model = timetableModel(data, clock, info.is_demo)
  const canEdit = data.can_edit && !info.is_demo

  const startEdit = () => {
    setEditing(data.slots)
    setHours(data.hours.map((h) => ({ ...h })))
    setTimezone(data.timezone || 'Europe/Rome')
    setNotes({})
    setUnplaced([])
    setSaved(false)
  }
  const setHour = (hour: number, field: 'start' | 'end', value: string) => {
    setHours((prev) => (prev ?? data.hours).map((h) => (h.hour === hour ? { ...h, [field]: value } : h)))
  }

  const setSlot = (w: number, h: number, subject: string | null, room: string) => {
    setNotes((prev) => {
      if (!prev[`${w}-${h}`]) return prev
      const next = { ...prev }
      delete next[`${w}-${h}`]
      return next
    })
    setEditing((prev) => {
      const base = (prev ?? data.slots).filter((s) => !(s.weekday === w && s.hour === h))
      return subject ? [...base, { weekday: w, hour: h, subject_code: subject, room, is_lab: /^l/i.test(room.trim()) }] : base
    })
  }
  const stopEdit = () => {
    setEditing(null)
    setHours(null)
    setNotes({})
    setUnplaced([])
  }
  const readPhoto = async (file: File) => {
    if (reading) return
    const image = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name)
    if (!image) {
      setPhotoError(t('class.tt_not_image'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError(t('class.tt_too_big'))
      return
    }
    cancelRead.current = false
    setReading(true)
    setPhotoError(null)
    setSaved(false)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('privacy_ok', 'true')
      const att = await api.post<{ id: number }>(classPath(info.code, '/attachments'), body)
      if (cancelRead.current) return
      const started = await api.post<{ job_id: string }>(classPath(info.code, '/ocr'), { purpose: 'timetable', attachment_id: att.id })
      let result: TimetableOcr | null = null
      for (let i = 0; i < 90; i++) {
        if (cancelRead.current) return
        result = await api.get<TimetableOcr>(classPath(info.code, `/ocr/${started.job_id}`))
        if (result.status === 'done' || result.status === 'error') break
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      if (cancelRead.current) return
      const grid = result?.timetable
      const usable = grid?.slots.filter((cell) => cell.subject_code) ?? []
      const flagged = grid?.slots.some((cell) => cell.needs_check) || (grid?.unplaced.length ?? 0) > 0
      if (!result || result.status !== 'done' || !grid || (!usable.length && !flagged)) {
        throw new Error(result?.message || t('class.tt_unreadable'))
      }
      setEditing(usable.map((cell) => ({
        weekday: cell.weekday,
        hour: cell.hour,
        subject_code: cell.subject_code as string,
        room: cell.room,
        is_lab: cell.is_lab,
      })))
      setHours(data.hours.map((hour) => ({ ...hour })))
      setTimezone(data.timezone || 'Europe/Rome')
      setNotes(Object.fromEntries(grid.slots.filter((cell) => cell.needs_check).map((cell) => [`${cell.weekday}-${cell.hour}`, cell.check_reason])))
      setUnplaced(grid.unplaced)
    } catch (error) {
      if (!cancelRead.current) setPhotoError((error as Error).message || t('class.tt_unreadable'))
    } finally {
      setReading(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {!editing && hasAny && (
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: t('class.tt_view_day') },
              { value: 'week', label: t('class.tt_view_week') },
            ]}
          />
        )}
        {editing && <p className="text-sm text-muted"><span className="language-text">{t('class.tt_lab_hint')}</span></p>}
        {canEdit && !editing && !reading && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="min-h-11" onClick={startEdit}>
              <Pencil className="size-4" /> <span className="language-text">{t('class.tt_edit')}</span>
            </Button>
            <Button size="sm" variant="secondary" className="min-h-11" disabled={!privacy} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> <span className="language-text">{t('class.tt_from_photo')}</span>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={t('class.tt_from_photo')}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void readPhoto(file)
              }}
            />
          </div>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="min-h-11" onClick={stopEdit}><span className="language-text">{t('common.cancel')}</span></Button>
            <Button size="sm" className="min-h-11" onClick={() => editing && save.mutate({ slots: editing, hours: hours ?? data.hours, timezone })} loading={save.isPending}><span className="language-text">{t('class.tt_save')}</span></Button>
          </div>
        )}
      </div>
      {editing && hours && (
        <div className="mb-4 space-y-3 rounded-2xl border border-line bg-surface p-3">
          <label className="block max-w-xs">
            <span className="mb-1 block text-sm font-semibold"><span className="language-text">{t('class.tt_timezone')}</span></span>
            <select className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {ZONES.map((z) => <option key={z} value={z}>{z === 'Europe/Rome' ? `Roma (${z})` : z}</option>)}
            </select>
          </label>
          <p className="text-sm font-semibold"><span className="language-text">{t('class.tt_bell')}</span></p>
          <div className="grid gap-2 sm:grid-cols-2">
            {hours.map((h) => (
              <div key={h.hour} className="flex items-center gap-2">
                <span className="w-8 text-sm font-bold">{h.hour}ª</span>
                <input type="time" className={inputClass} value={h.start} onChange={(e) => setHour(h.hour, 'start', e.target.value)} />
                <input type="time" className={inputClass} value={h.end} onChange={(e) => setHour(h.hour, 'end', e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}
      {canEdit && !editing && !reading && (
        <label className="mb-3 flex min-h-11 items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-bordeaux" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />
          <span className="language-text">{t('class.tt_photo_privacy')}</span>
        </label>
      )}
      {reading && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-3">
          <Spinner />
          <p className="text-sm font-semibold"><span className="language-text">{t('class.tt_reading')}</span></p>
          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => { cancelRead.current = true }}><span className="language-text">{t('class.tt_cancel_read')}</span></Button>
        </div>
      )}
      {photoError && <p role="alert" className="mb-3 text-sm font-medium text-rosa-ink">{photoError}</p>}
      {editing && (Object.keys(notes).length > 0 || unplaced.length > 0) && (
        <div className="mb-3 space-y-1 text-sm">
          <p className="font-semibold"><span className="language-text">{t('class.tt_preview')}</span></p>
          {unplaced.map((item, index) => (
            <p key={`${item.raw_subject}-${index}`} className="font-medium">
              <span className="language-text">{t('class.tt_unplaced', { what: item.raw_subject || t(`class.tt_flag_${item.reason}`) })}</span>
            </p>
          ))}
        </div>
      )}
      {saved && <p role="status" className="mb-2 text-sm font-semibold text-verde-ink"><span className="language-text">{t('class.tt_saved')}</span></p>}
      {save.error && <p role="alert" className="mb-2 text-sm font-medium text-rosa-ink">{(save.error as Error).message}</p>}
      {!hasAny && !editing && (
        <Card>
          <EmptyState title={t('class.tt_not_set')} text={t(canEdit ? 'class.tt_not_set_admin' : 'class.tt_not_set_member')} />
        </Card>
      )}
      {editing && <WeekGrid data={data} slots={slots} hours={rows} model={null} editing notes={notes} onEdit={(weekday, hour) => setCell({ weekday, hour })} />}
      {!editing && hasAny && (view === 'day' ? <DayView data={data} model={model} demo={info.is_demo} /> : <WeekGrid data={data} slots={slots} hours={rows} model={model} />)}
      {data.can_edit && info.is_demo && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <Lock className="size-3.5 shrink-0" aria-hidden /> <span className="language-text">{t('class.tt_demo_locked')}</span>
        </p>
      )}
      {cell && (
        <CellModal
          key={`${cell.weekday}-${cell.hour}`}
          title={t('class.tt_cell', { day: weekdayName(cell.weekday, lang), hour: cell.hour })}
          slot={at(cell.weekday, cell.hour)}
          subjects={data.subjects}
          onClose={() => setCell(null)}
          onSave={(subject, room) => {
            setSlot(cell.weekday, cell.hour, subject, room)
            setCell(null)
          }}
        />
      )}
    </div>
  )
}

type TimetableOcr = {
  status: string
  message: string
  timetable: {
    slots: { weekday: number; hour: number; subject_code: string | null; room: string; is_lab: boolean; needs_check: boolean; check_reason: string }[]
    unplaced: { raw_subject: string; reason: string }[]
  } | null
}

function CellModal({ title, slot, subjects, onClose, onSave }: { title: string; slot?: Slot; subjects: TimetableData['subjects']; onClose: () => void; onSave: (subject: string | null, room: string) => void }) {
  const { t, i18n } = useTranslation()
  const [subject, setSubject] = useState(slot?.subject_code ?? '')
  const [room, setRoom] = useState(slot?.room ?? '')
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        <Field label={t('class.tt_subject')}>
          <select className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">{t('class.tt_free')}</option>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>{s.code} · {subjectName(subjects, s.code, i18n.language)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('class.tt_room')} hint={t('class.tt_lab_hint')}>
          <input className={inputClass} value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="A215 / L143" maxLength={20} disabled={!subject} />
        </Field>
        <Button className="w-full" onClick={() => onSave(subject || null, room)}><span className="language-text">{t('common.save')}</span></Button>
      </div>
    </Modal>
  )
}
