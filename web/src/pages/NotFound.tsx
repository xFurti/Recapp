import { FileQuestion } from 'lucide-react'
import { useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LangToggle, Logo, ThemeToggle } from '../components/shell'
import { ClassContext, useMe } from '../queries'

const linkClass =
  'btn-spring inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold sm:w-auto'

/** An original gorilla, not a copy of any cartoon character. */
function Gorilla() {
  return (
    <svg viewBox="0 0 88 96" className="h-20 w-[4.5rem] shrink-0" aria-hidden>
      <ellipse cx="40" cy="78" rx="26" ry="16" fill="#5c4638" />
      <ellipse cx="40" cy="80" rx="14" ry="10" fill="#f0d2b4" />
      <path d="M16 68c-10 4-14 16-8 22 4 2 10-2 12-10" fill="#5c4638" />
      <path d="M58 64c8-14 18-20 24-14 4 4 2 10-4 14-6 8-14 10-20 6" fill="#5c4638" />
      <circle cx="78" cy="46" r="7" fill="#f0d2b4" />
      <circle cx="14" cy="40" r="8" fill="#6b5344" />
      <circle cx="66" cy="40" r="8" fill="#6b5344" />
      <circle cx="14" cy="40" r="4.5" fill="#f0d2b4" />
      <circle cx="66" cy="40" r="4.5" fill="#f0d2b4" />
      <circle cx="40" cy="38" r="22" fill="#6b5344" />
      <ellipse cx="40" cy="44" rx="14" ry="12" fill="#f0d2b4" />
      <circle cx="33" cy="36" r="2.4" fill="#1d1b1e" />
      <circle cx="47" cy="36" r="2.4" fill="#1d1b1e" />
      <ellipse cx="40" cy="43" rx="4" ry="3" fill="#5c4638" />
      <path d="M33 49q7 6 14 0" stroke="#5c4638" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Unknown address. Stays on that URL. "Oggi" appears only for a class the viewer can already open. */
export default function NotFound() {
  const { t, i18n } = useTranslation()
  const info = useContext(ClassContext)
  const me = useMe()
  const today =
    info?.code ?? (me.data?.kind === 'member' ? me.data.classroom.code : null)
  const [gorilla, setGorilla] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = t('notFound.document_title')
    return () => {
      document.title = previous
    }
  }, [t, i18n.language])

  return (
    <div className={info ? '' : 'flex min-h-dvh flex-col'}>
      {!info && (
        <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:py-3.5">
            <Link to="/" aria-label={t('common.app_name')}>
              <Logo className="h-8 sm:h-10" />
            </Link>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <LangToggle />
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <div className="not-found-in flex w-full max-w-sm flex-col items-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-bordeaux-soft text-bordeaux">
            <FileQuestion className="size-8" aria-hidden />
          </div>
          <button
            type="button"
            onClick={() => setGorilla((open) => !open)}
            aria-expanded={gorilla}
            aria-label={t('notFound.egg_label')}
            className="mt-6 cursor-pointer text-6xl font-extrabold tracking-tight text-bordeaux"
          >
            404
          </button>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('notFound.title')}</h1>
          <p className="mt-3 text-base text-muted">{t('notFound.body')}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <Link to="/" className={`${linkClass} bg-bordeaux text-white shadow-sm hover:bg-bordeaux-dark`}>
              {t('notFound.home')}
            </Link>
            {today && (
              <Link to={`/c/${today}`} className={`${linkClass} border border-line bg-surface text-ink hover:border-ink/30`}>
                {t('notFound.today')}
              </Link>
            )}
          </div>
          {gorilla && (
            <div className="not-found-gorilla mt-8 flex max-w-xs items-end gap-2 text-left">
              <Gorilla />
              <p className="rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-sm text-ink">{t('notFound.egg')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
