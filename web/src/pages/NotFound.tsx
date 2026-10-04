import { lazy, Suspense, useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LangToggle, Logo, ThemeToggle } from '../components/shell'
import { ClassContext, useMe } from '../queries'

const MagillaGame = lazy(() => import('../components/magilla/MagillaGame'))

const linkClass =
  'btn-spring inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold sm:w-auto'

/** Unknown address. Stays on that URL. "Oggi" appears only for a class the viewer can already open. */
export default function NotFound() {
  const { t, i18n } = useTranslation()
  const info = useContext(ClassContext)
  const me = useMe()
  const today =
    info?.code ?? (me.data?.kind === 'member' ? me.data.classroom.code : null)

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
            <Logo className="h-8 sm:h-10" />
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <LangToggle />
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6 text-center sm:py-12">
        <div className="not-found-in flex w-full flex-col items-center">
          <Suspense fallback={<div className="aspect-[16/9] w-full rounded-2xl border border-line bg-linear-to-b from-azzurro-soft to-paper sm:aspect-[3/1]" />}>
            <MagillaGame />
          </Suspense>
          <div className="mt-6 flex w-full max-w-lg flex-col items-center sm:mt-8">
            <p className="rounded-full bg-bordeaux-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-bordeaux">
              <span className="language-text">{t('notFound.eyebrow')}</span>
            </p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl"><span className="language-text">{t('notFound.title')}</span></h1>
            <p className="mt-3 text-base text-muted"><span className="language-text">{t('notFound.body')}</span></p>
            <p className="mt-2 text-sm text-muted"><span className="language-text">{t('notFound.magilla')}</span></p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
              <Link to="/" className={`${linkClass} bg-bordeaux text-white shadow-sm hover:bg-bordeaux-dark`}>
                <span className="language-text">{t('notFound.home')}</span>
              </Link>
              {today && (
                <Link to={`/c/${today}`} className={`${linkClass} border border-line bg-surface text-ink hover:border-ink/30`}>
                  <span className="language-text">{t('notFound.today')}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
