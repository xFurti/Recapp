import { ArrowUp, ArrowUpRight, CalendarDays, Check, ChevronDown, Search, Sparkles, Wrench, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PageIntro, PageReturn, SupportHeader } from '../components/SupportPage'
import { Button, inputClass, Segmented, Spinner } from '../components/ui'
import { appVersion, demoReleaseAccount, localized, officialReleaseAccount, rememberRelease, useReleases, type Release } from '../lib/releases'
import { useMe } from '../queries'

const categories = [
  { name: 'feature', icon: Sparkles, tone: 'bg-bordeaux-soft text-bordeaux' },
  { name: 'improvement', icon: Wrench, tone: 'bg-azzurro-soft text-azzurro-ink' },
  { name: 'fix', icon: Check, tone: 'bg-verde-soft text-verde-ink' },
] as const

/** Feeds the card spotlight its pointer position. */
function spotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const box = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--x', `${event.clientX - box.left}px`)
  event.currentTarget.style.setProperty('--y', `${event.clientY - box.top}px`)
}

/** The UTC day shown on each card, so filters and labels never disagree. */
const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10)
const validDay = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null
/** Case and accent insensitive: "Novità" matches "novita". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const smooth = (): ScrollBehavior => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/** Marks every occurrence of the search terms, mapping folded matches back to the original text. */
function Highlight({ text, terms }: { text: string; terms: string[] }): ReactNode {
  if (!terms.length) return text
  let folded = ''
  const origin: number[] = []
  let position = 0
  for (const char of text) {
    const part = fold(char)
    folded += part
    for (let k = 0; k < part.length; k++) origin.push(position)
    position += char.length
  }
  origin.push(text.length)
  const ranges: [number, number][] = []
  for (const term of terms) {
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + term.length)) ranges.push([origin[at], origin[at + term.length]])
  }
  if (!ranges.length) return text
  ranges.sort((a, b) => a[0] - b[0])
  const parts: ReactNode[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (end <= cursor) continue
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(<mark key={start} className="release-mark">{text.slice(Math.max(start, cursor), end)}</mark>)
    cursor = end
  }
  parts.push(text.slice(cursor))
  return parts
}

type Group = { key: string; releases: Release[] }
type Month = { key: string; days: Group[]; count: number }

export default function News() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const notes = useReleases()
  const me = useMe()
  const lang = i18n.language
  const locale = lang.startsWith('it') ? 'it-IT' : 'en-GB'
  const header = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const datePanel = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  const [opened, setOpened] = useState(new Map<string, boolean>())
  const [activeMonth, setActiveMonth] = useState('')

  const query = params.get('q') ?? ''
  const day = validDay(params.get('giorno'))
  const from = validDay(params.get('dal'))
  const to = validDay(params.get('al'))
  const [mode, setMode] = useState<'day' | 'range'>(from || to ? 'range' : 'day')
  const [datesOpen, setDatesOpen] = useState(!!(day || from || to))
  const [lo, hi] = day ? [day, day] : from && to && from > to ? [to, from] : [from, to]
  const terms = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query])
  const filtering = terms.length > 0 || !!lo || !!hi

  useEffect(() => {
    if (!notes.data?.current || (appVersion !== 'dev' && notes.data.version !== appVersion)) return
    const who = me.data
    const account = who?.kind === 'member'
      ? (who.classroom.is_demo ? demoReleaseAccount : officialReleaseAccount('member', who.member.id))
      : who?.kind === 'owner' ? officialReleaseAccount('owner', who.owner.username) : null
    if (account) rememberRelease(account, notes.data.current).catch(() => undefined)
  }, [notes.data, me.data])

  const releases = useMemo(() => notes.data?.releases ?? [], [notes.data])
  const latest = releases[0]?.id
  const { shown, matches } = useMemo(() => {
    const matches = new Map<string, Set<number>>()
    const shown = releases.filter((release) => {
      const date = dayOf(release.published_at)
      if ((lo && date < lo) || (hi && date > hi)) return false
      if (!terms.length) return true
      const texts = release.entries.map((entry) => fold(`${localized(entry.title, lang)}\n${localized(entry.body, lang)}`))
      const all = [fold(localized(release.title, lang)), `v${release.id}`, ...texts].join('\n')
      if (!terms.every((term) => all.includes(term))) return false
      matches.set(release.id, new Set(texts.flatMap((text, index) => terms.some((term) => text.includes(term)) ? [index] : [])))
      return true
    })
    return { shown, matches }
  }, [releases, lo, hi, terms, lang])
  const months = useMemo(() => {
    const months: Month[] = []
    for (const release of shown) {
      const date = dayOf(release.published_at)
      let month = months.at(-1)
      if (month?.key !== date.slice(0, 7)) months.push(month = { key: date.slice(0, 7), days: [], count: 0 })
      let group = month.days.at(-1)
      if (group?.key !== date) month.days.push(group = { key: date, releases: [] })
      group.releases.push(release)
      month.count++
    }
    return months
  }, [shown])
  const isOpen = (id: string) => opened.get(id) ?? (id === latest || terms.length > 0)

  // The sticky header grows with the date panel: cards and labels scroll in just below it.
  useEffect(() => {
    const element = header.current
    if (!element) return
    const observer = new ResizeObserver(() => setTop(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Follows the month being read, and folds the date panel away once the reader moves on.
  const openedAt = useRef(0)
  useEffect(() => { if (datesOpen) openedAt.current = scrollY }, [datesOpen])
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = (header.current?.offsetHeight ?? 0) + 8
      let active = months[0]?.key ?? ''
      for (const month of months) {
        const section = document.getElementById(`month-${month.key}`)?.parentElement
        if (section && section.getBoundingClientRect().top <= line) active = month.key
      }
      // At the very end the last months cannot reach the header: the one jumped to is the last.
      if (months.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 2 && scrollY > 0) active = months.at(-1)!.key
      setActiveMonth(active)
      if (datesOpen && Math.abs(scrollY - openedAt.current) > 160 && !datePanel.current?.contains(document.activeElement)) setDatesOpen(false)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    return () => { removeEventListener('scroll', schedule); removeEventListener('resize', schedule); cancelAnimationFrame(frame) }
  }, [months, datesOpen])

  // A new search or period starts reading from the first result.
  const filterKey = `${query}|${lo}|${hi}`
  const lastFilter = useRef(filterKey)
  useEffect(() => {
    if (lastFilter.current === filterKey) return
    lastFilter.current = filterKey
    const box = list.current?.getBoundingClientRect()
    if (box && box.top < (header.current?.offsetHeight ?? 0)) scrollTo({ top: scrollY + box.top - (header.current?.offsetHeight ?? 0) - 16 })
  }, [filterKey])

  // /novita#release-<id> (also from the popup) always lands on a readable note: hidden by
  // filters → filters are cleared; collapsed → it opens; then it scrolls below the header.
  useEffect(() => {
    if (!notes.data || !location.hash) return
    const target = decodeURIComponent(location.hash.slice(1))
    const id = target.replace(/^release-/, '')
    if (!notes.data.releases.some((release) => release.id === id)) return
    if (!shown.some((release) => release.id === id)) {
      navigate({ hash: location.hash }, { replace: true })
      return
    }
    setOpened((current) => current.get(id) ? current : new Map(current).set(id, true))
    // Cards above may still be folding (300ms): keep the note aligned until the layout settles.
    const until = performance.now() + 400
    let frame = 0
    const align = () => {
      document.getElementById(target)?.scrollIntoView({ block: 'start' })
      if (performance.now() < until) frame = requestAnimationFrame(align)
    }
    frame = requestAnimationFrame(align)
    return () => cancelAnimationFrame(frame)
    // Only a new link (or the data arriving) should move the page, not later filter edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.data, location.hash, location.search])

  function update(next: Record<string, string | null>) {
    setParams((current) => {
      const result = new URLSearchParams(current)
      for (const [key, value] of Object.entries(next)) {
        if (value) result.set(key, value)
        else result.delete(key)
      }
      return result
    }, { replace: true })
  }
  function switchMode(next: 'day' | 'range') {
    setMode(next)
    if (next === 'range') update({ giorno: null, dal: day, al: day })
    else update({ giorno: from ?? to, dal: null, al: null })
  }
  function clear() {
    update({ q: null, giorno: null, dal: null, al: null })
    setDatesOpen(false)
  }
  function toMonth(key: string) {
    document.getElementById(`month-${key}`)?.scrollIntoView({ block: 'start', behavior: smooth() })
  }
  function toLatest() {
    const box = list.current?.getBoundingClientRect()
    scrollTo({ top: box ? Math.max(0, scrollY + box.top - (header.current?.offsetHeight ?? 0) - 16) : 0, behavior: smooth() })
  }

  const format = (key: string, options: Intl.DateTimeFormatOptions) =>
    capitalize(new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`)))
  const short = (key: string) => format(key, { dateStyle: 'medium' })
  const period = day ? short(day)
    : lo && hi ? t('news.filter_range', { from: short(lo), to: short(hi) })
    : lo ? t('news.filter_from', { from: short(lo) })
    : hi ? t('news.filter_to', { to: short(hi) }) : null
  const oldest = releases.length ? dayOf(releases.at(-1)!.published_at) : undefined
  const newest = releases.length ? dayOf(releases[0].published_at) : undefined
  let order = 0

  return (
    <div className="support-page min-h-dvh" style={{ '--news-top': `${top}px` } as CSSProperties}>
      <SupportHeader headerRef={header}>
        {releases.length > 0 && <div role="search" className="support-width pb-3">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <label className="relative order-1 min-w-0 flex-1">
              <span className="sr-only">{t('news.search')}</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input type="search" value={query} onChange={(event) => update({ q: event.target.value || null })}
                placeholder={t('news.search_placeholder')} enterKeyHint="search" className={`${inputClass} min-h-11 pl-9`} />
            </label>
            <button type="button" onClick={() => setDatesOpen(!datesOpen)} aria-expanded={datesOpen} aria-controls="news-dates"
              aria-label={t('news.dates')} className={`release-tool relative order-2 flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${datesOpen || lo || hi ? 'border-bordeaux/50 bg-bordeaux-soft text-bordeaux' : 'border-line bg-surface hover:border-ink/40'}`}>
              <CalendarDays className="size-5" aria-hidden />
              <span aria-hidden className="language-text hidden sm:inline">{t('news.dates_short')}</span>
              {(lo || hi) && <span aria-hidden className="absolute -right-1 -top-1 size-2.5 rounded-full bg-bordeaux ring-2 ring-paper" />}
            </button>
            {months.length > 1 && <label className={`order-7 shrink-0 sm:order-3 sm:mt-0 ${filtering ? 'mt-1' : 'mt-2'}`}>
              <span className="sr-only">{t('news.month')}</span>
              <select value={activeMonth} onChange={(event) => toMonth(event.target.value)} className="min-h-11 max-w-44 rounded-xl border border-line bg-surface px-2 text-sm font-semibold text-ink sm:max-w-none">
                {months.map((month) => <option key={month.key} value={month.key}>{format(`${month.key}-01`, { month: 'long', year: 'numeric' })} · {month.count}</option>)}
              </select>
            </label>}
            <button type="button" onClick={toLatest} aria-label={t('news.to_latest')} title={t('news.to_latest')}
              className="release-tool order-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 font-semibold hover:border-ink/40 sm:order-4">
              <ArrowUp className="size-4" aria-hidden /><span aria-hidden className="language-text hidden sm:inline">{t('news.latest_short')}</span>
            </button>
            <span aria-hidden className="order-4 h-0 basis-full sm:order-5" />
            <p role="status" className={`order-5 release-count mt-2 min-w-0 text-muted sm:order-6 ${filtering ? 'basis-full text-xs sm:basis-0 sm:flex-1 sm:text-sm' : 'flex-1'}`}>
              <span className="language-text">
                {filtering ? t('news.results', { count: shown.length, total: releases.length }) : t('news.count', { count: releases.length })}
                {period && <> · <span className="font-semibold text-ink">{period}</span></>}
              </span>
            </p>
            {filtering && <button type="button" onClick={clear} className="release-tool order-6 -ml-2 mr-auto mt-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 font-semibold text-bordeaux hover:bg-bordeaux-soft sm:order-7 sm:mr-0 sm:mt-2 sm:min-h-8">
              <X className="size-4" aria-hidden /><span className="language-text">{t('news.clear')}</span>
            </button>}
          </div>
          <div id="news-dates" ref={datePanel} className="release-collapse" data-open={datesOpen || undefined} inert={!datesOpen}>
            <div>
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2 pt-3">
                <Segmented value={mode} onChange={switchMode} className="shrink-0"
                  options={[{ value: 'day', label: t('news.day') }, { value: 'range', label: t('news.range') }]} />
                {mode === 'day' ? <label className="min-w-0 flex-1 basis-40">
                  <span className="language-text mb-1 block text-xs font-semibold text-muted">{t('news.pick_day')}</span>
                  <input type="date" value={day ?? ''} min={oldest} max={newest} onChange={(event) => update({ giorno: event.target.value || null })} className={`${inputClass} min-h-11`} />
                </label> : <div className="grid min-w-0 flex-1 basis-64 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                  <label className="min-w-0">
                    <span className="language-text mb-1 block text-xs font-semibold text-muted">{t('news.from')}</span>
                    <input type="date" value={from ?? ''} min={oldest} max={to ?? newest} onChange={(event) => update({ dal: event.target.value || null })} className={`${inputClass} min-h-11`} />
                  </label>
                  <label className="min-w-0">
                    <span className="language-text mb-1 block text-xs font-semibold text-muted">{t('news.to')}</span>
                    <input type="date" value={to ?? ''} min={from ?? oldest} max={newest} onChange={(event) => update({ al: event.target.value || null })} className={`${inputClass} min-h-11`} />
                  </label>
                </div>}
              </div>
            </div>
          </div>
        </div>}
      </SupportHeader>
      <main className="support-width support-main">
        <PageReturn onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}>{t('common.back')}</PageReturn>
        <PageIntro icon={Sparkles} title={t('news.title')} description={<span className="language-text">{t('news.intro')}</span>} />
        {notes.isLoading && <Spinner />}
        {notes.isError && <div role="status" className="rounded-2xl border border-line bg-surface p-5">
          <p><span className="language-text">{t('news.error')}</span></p>
          <Button variant="secondary" className="mt-4" onClick={() => notes.refetch()}><span className="language-text">{t('common.retry')}</span></Button>
        </div>}
        {notes.data && !releases.length && <p className="text-muted"><span className="language-text">{t('news.empty')}</span></p>}
        <div ref={list}>
          {releases.length > 0 && !shown.length && <div className="release-empty rounded-3xl border border-dashed border-line bg-surface p-6 text-center">
            <Search className="mx-auto size-8 text-muted" aria-hidden />
            <h2 className="mt-3 text-lg font-bold"><span className="language-text">{t('news.no_results')}</span></h2>
            <p className="mt-1 text-sm text-muted"><span className="language-text">{t('news.no_results_hint')}</span></p>
            <Button variant="secondary" className="mt-4" onClick={clear}><span className="language-text">{t('news.clear')}</span></Button>
          </div>}
          {months.length > 0 && <ol className="release-timeline">
            {months.map((month) => <li key={month.key} className="release-month">
              <h2 id={`month-${month.key}`} className="release-month-title"><span className="language-text">{format(`${month.key}-01`, { month: 'long', year: 'numeric' })}</span></h2>
              <ol>
                {month.days.map((group) => <li key={group.key} className="release-day">
                  <p className="release-day-label">
                    <span className="language-text"><time dateTime={group.key}>{format(group.key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
                      {' · '}{t('news.count', { count: group.releases.length })}</span>
                  </p>
                  <ol className="space-y-4">
                    {group.releases.map((release) => {
                      const open = isOpen(release.id)
                      const matched = matches.get(release.id)
                      return <li key={release.id} className="release-entry" data-latest={release.id === notes.data!.current || undefined} style={{ '--i': order++ } as CSSProperties}>
                        <span aria-hidden className="release-dot" />
                        <article id={`release-${release.id}`} onPointerMove={spotlight} data-open={open || undefined} className="release-card support-panel">
                          <div className="release-head p-5 sm:px-7">
                            <h3 className="release-title">
                              <button type="button" aria-expanded={open} aria-controls={`release-body-${release.id}`}
                                onClick={() => setOpened((current) => new Map(current).set(release.id, !open))}
                                className="release-toggle flex w-full items-start justify-between gap-3 text-left">
                                <span className="language-text min-w-0 break-words"><Highlight text={localized(release.title, lang)} terms={terms} /></span>
                                <ChevronDown aria-hidden className="release-chevron mt-1 size-5 shrink-0 text-muted" />
                              </button>
                            </h3>
                            {release.summary[0] && <p className="release-benefit text-muted"><span className="language-text">{localized(release.summary[0], lang)}</span></p>}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 support-meta">
                              <time dateTime={release.published_at}><span className="language-text">{new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(release.published_at))}</span></time>
                              <span className="rounded-full bg-paper px-2.5 py-1 tabular-nums"><Highlight text={`v${release.id}`} terms={terms} /></span>
                              {release.id === notes.data!.current && <span className="inline-flex items-center gap-2 rounded-full bg-verde-soft px-2.5 py-1 text-verde-ink">
                                <span aria-hidden className="release-pulse" /><span className="language-text">{t('news.latest')}</span>
                              </span>}
                              {!!matched?.size && <span className="rounded-full bg-giallo-soft px-2.5 py-1 text-ink"><span className="language-text">{t('news.matches', { count: matched.size })}</span></span>}
                            </div>
                          </div>
                          <div id={`release-body-${release.id}`} className="release-collapse" data-open={open || undefined} inert={!open}>
                            <div>
                              <div className="px-5 pb-5 sm:px-7 sm:pb-7">
                                {categories.map((category) => {
                                  const entries = release.entries.flatMap((entry, index) => entry.category === category.name ? [{ entry, index }] : [])
                                  return entries.length > 0 && <section key={category.name} className="mt-1 border-t border-line pt-5 [&+section]:mt-6">
                                    <h4 className="flex items-center gap-2 text-sm font-bold">
                                      <span className={`flex size-8 items-center justify-center rounded-lg ${category.tone}`}><category.icon className="size-4" aria-hidden /></span>
                                      <span className="language-text">{t(`news.${category.name}`)}</span>
                                    </h4>
                                    <ul className="mt-4 space-y-5">
                                      {entries.map(({ entry, index }) => <li key={index} className="release-note min-w-0" data-match={matched?.has(index) || undefined} data-dim={(matched && !matched.has(index)) || undefined}>
                                        <h5 className="font-bold"><span className="language-text"><Highlight text={localized(entry.title, lang)} terms={terms} /></span></h5>
                                        <p className="mt-1.5 release-details whitespace-pre-line break-words text-muted"><span className="language-text"><Highlight text={localized(entry.body, lang)} terms={terms} /></span></p>
                                        {entry.image && <img src={entry.image.src} alt={localized(entry.image.alt, lang)} loading="lazy" className="mt-4 w-full rounded-xl border border-line" />}
                                        {entry.link && <div className="mt-3">
                                          {entry.link.href.startsWith('/') ? <Link to={entry.link.href} className="release-link inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-bordeaux hover:underline">
                                            <span className="language-text">{localized(entry.link.label, lang)}</span><ArrowUpRight className="size-4" aria-hidden />
                                          </Link> : <a href={entry.link.href} target="_blank" rel="noopener noreferrer" className="release-link inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-bordeaux hover:underline">
                                            <span className="language-text">{localized(entry.link.label, lang)}</span><ArrowUpRight className="size-4" aria-hidden />
                                          </a>}
                                          {entry.link.requires_login && <span className="ml-2 text-xs text-muted"><span className="language-text">{t('news.login_required')}</span></span>}
                                        </div>}
                                      </li>)}
                                    </ul>
                                  </section>
                                })}
                              </div>
                            </div>
                          </div>
                        </article>
                      </li>
                    })}
                  </ol>
                </li>)}
              </ol>
            </li>)}
          </ol>}
        </div>
        <p className="mt-8 text-sm text-muted"><span className="language-text">{t('news.footer')}</span></p>
      </main>
    </div>
  )
}
