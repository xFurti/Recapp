import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Trash2, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { timeOf } from '../lib/format'
import { classPath } from '../queries'
import type { MemberBrief } from '../types'
import { Avatar, Badge, Button, Chip, inputClass } from './ui'

export interface Comment {
  id: number
  kind: 'comment' | 'correction'
  body: string
  resolved: boolean
  author: MemberBrief | null
  created_at: string
  mine: boolean
}

interface FeedbackData {
  thanks: number
  thanked: boolean
  open_corrections: number
  comments: Comment[]
}

export function useFeedback(code: string, day: string, enabled: boolean) {
  return useQuery({
    queryKey: ['feedback', code, day],
    queryFn: () => api.get<FeedbackData>(classPath(code, `/cards/${day}/feedback`)),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })
}

export function Feedback({ code, day, readOnly }: { code: string; day: string; readOnly: boolean }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const fb = useFeedback(code, day, true)
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'comment' | 'correction'>('comment')
  const refresh = () => qc.invalidateQueries({ queryKey: ['feedback', code, day] })

  const thanks = useMutation({ mutationFn: () => api.post(classPath(code, `/cards/${day}/thanks`)), onSuccess: refresh })
  const send = useMutation({
    mutationFn: () => api.post(classPath(code, `/cards/${day}/comments`), { kind, body: body.trim() }),
    onSuccess: () => {
      setBody('')
      refresh()
    },
  })
  const patch = useMutation({
    mutationFn: (c: Comment) => api.patch(classPath(code, `/comments/${c.id}`), { resolved: !c.resolved }),
    onSuccess: refresh,
  })
  const del = useMutation({
    mutationFn: (c: Comment) => api.del(classPath(code, `/comments/${c.id}`)),
    onSuccess: refresh,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (body.trim()) send.mutate()
  }
  const data = fb.data
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <MessageCircle className="size-5 text-bordeaux" /> {t('feedback.replies')}
        </h3>
        <button
          onClick={() => !readOnly && thanks.mutate()}
          disabled={readOnly || thanks.isPending}
          aria-pressed={data?.thanked}
          aria-label={t('feedback.thanks_aria')}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition ${
            data?.thanked ? 'border-rosa bg-rosa-soft text-rosa-ink' : 'border-line hover:border-rosa/40'
          }`}
        >
          <Heart className={`size-4 ${data?.thanked ? 'fill-current' : ''}`} />
          {data ? t('feedback.thanks_count', { count: data.thanks }) : t('feedback.thanks')}
        </button>
      </div>

      {fb.isLoading && <p className="mt-3 text-sm text-muted">{t('common.loading')}</p>}
      {data && data.comments.length === 0 && <p className="mt-3 text-sm text-muted">{t('feedback.empty')}</p>}
      {data && data.comments.length > 0 && (
        <ul className="mt-3 space-y-3">
          {data.comments.map((c) => (
            <li key={c.id} className={`flex gap-3 rounded-xl p-3 ${c.kind === 'correction' && !c.resolved ? 'border border-giallo bg-giallo-soft' : 'bg-paper'}`}>
              {c.author && <Avatar nick={c.author.nick} color={c.author.color} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{c.author?.nick}</span>
                  {c.kind === 'correction' && (
                    <Badge className={c.resolved ? 'bg-verde-soft text-verde-ink' : 'bg-giallo text-[#1d1b1e]'}>
                      <TriangleAlert className="size-3" /> {c.resolved ? t('feedback.resolved') : t('feedback.kind_correction')}
                    </Badge>
                  )}
                  <span className="text-xs text-muted">{timeOf(c.created_at, i18n.language)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-line text-[15px]">{c.body}</p>
                <div className="mt-1 flex gap-3 text-xs font-semibold text-muted">
                  {c.kind === 'correction' && !readOnly && (
                    <button onClick={() => patch.mutate(c)} className="hover:text-ink">
                      {c.resolved ? t('feedback.reopen') : t('feedback.resolve')}
                    </button>
                  )}
                  {c.mine && (
                    <button onClick={() => window.confirm(t('feedback.delete_confirm')) && del.mutate(c)} className="inline-flex items-center gap-1 hover:text-rosa-ink">
                      <Trash2 className="size-3.5" /> {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <div className="flex gap-2">
            {(['comment', 'correction'] as const).map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {k === 'correction' && <TriangleAlert className="size-3.5" />} {t(`feedback.kind_${k}`)}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('feedback.placeholder')} maxLength={500} />
            <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
              {t('feedback.send')}
            </Button>
          </div>
          {send.error && <p className="text-sm font-medium text-rosa-ink">{(send.error as Error).message}</p>}
        </form>
      )}
    </section>
  )
}
