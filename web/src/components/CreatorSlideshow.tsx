import { ArrowLeft, ArrowRight, ExternalLink, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localized, type Creator } from '../content/about'
import { Stairs } from './ui'

function Portrait({ creator }: { creator: Creator }) {
  const { i18n } = useTranslation()
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-bordeaux-soft">
      {creator.photo && !failed ? (
        <img src={creator.photo.src} alt={localized(creator.photo.alt, i18n.language)} width={480} height={480} loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div aria-hidden className="flex flex-col items-center gap-5">
          <span className="flex size-24 items-center justify-center rounded-3xl bg-surface text-4xl font-extrabold text-bordeaux shadow-sm">{creator.name.trim().slice(0, 2).toUpperCase()}</span>
          <Stairs className="w-32 opacity-70" />
        </div>
      )}
    </div>
  )
}

export function CreatorSlideshow({ profiles }: { profiles: Creator[] }) {
  const { t, i18n } = useTranslation()
  const [index, setIndex] = useState(0)
  const active = Math.min(index, Math.max(0, profiles.length - 1))
  const select = (next: number) => setIndex((next + profiles.length) % profiles.length)
  if (!profiles.length) return (
    <div className="rounded-3xl border border-line bg-surface p-6">
      <Users className="mb-3 size-8 text-bordeaux" aria-hidden />
      <p className="font-semibold">{t('about.team_summary')}</p>
      <p className="mt-2 text-sm text-muted">{t('about.profiles_pending')}</p>
    </div>
  )
  return (
    <section aria-label={t('about.creators_title')} aria-roledescription={t('about.carousel')} className="rounded-3xl border border-line bg-surface p-5 sm:p-6" onKeyDown={(event) => {
      if (!(event.target instanceof HTMLButtonElement)) return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      select(event.key === 'Home' ? 0 : event.key === 'End' ? profiles.length - 1 : active + (event.key === 'ArrowRight' ? 1 : -1))
    }}>
      <div className="grid">
        {profiles.map((creator, position) => (
          <article key={creator.id} aria-hidden={position !== active} inert={position !== active} aria-label={t('about.profile_position', { current: position + 1, total: profiles.length })} className="creator-slide col-start-1 row-start-1 grid min-w-0 content-start gap-5 sm:grid-cols-[12rem_1fr] sm:items-center" data-active={position === active}>
            <Portrait key={`${creator.id}-${creator.photo?.src}`} creator={creator} />
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <p className="text-sm font-semibold text-bordeaux">{localized(creator.role, i18n.language)}</p>
              <h3 className="mt-1 text-2xl font-extrabold tracking-tight">{creator.name}</h3>
              {localized(creator.bio, i18n.language).trim() && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{localized(creator.bio, i18n.language)}</p>}
              {!!creator.links?.length && <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {creator.links.filter(link => /^https?:\/\//i.test(link.href)).map(link => <li key={link.href}><a href={link.href} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-bordeaux underline underline-offset-4">{link.label}<ExternalLink className="size-4" aria-hidden /></a></li>)}
              </ul>}
            </div>
          </article>
        ))}
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-5 text-sm text-muted">{t('about.profile_status', { name: profiles[active].name, current: active + 1, total: profiles.length })}</p>
      {profiles.length > 1 && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex gap-2">
          <button type="button" aria-label={t('about.previous')} onClick={() => select(active - 1)} className="about-action flex size-11 items-center justify-center rounded-xl border border-line hover:bg-paper"><ArrowLeft className="size-5" aria-hidden /></button>
          <button type="button" aria-label={t('about.next')} onClick={() => select(active + 1)} className="about-action flex size-11 items-center justify-center rounded-xl border border-line hover:bg-paper"><ArrowRight className="size-5" aria-hidden /></button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={t('about.select_creator')}>
          {profiles.map((creator, position) => <button key={creator.id} type="button" aria-pressed={position === active} onClick={() => select(position)} className={`about-action min-h-11 max-w-full rounded-xl border px-3 py-2 text-sm font-semibold [overflow-wrap:anywhere] ${position === active ? 'border-bordeaux bg-bordeaux-soft text-bordeaux' : 'border-line text-muted hover:bg-paper'}`}>{creator.name}</button>)}
        </div>
      </div>}
    </section>
  )
}
