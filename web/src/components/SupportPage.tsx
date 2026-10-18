import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LangToggle, Logo, ThemeToggle, Wordmark } from './shell'
import '../support-pages.css'

/** Shared public chrome; school tools get a wider, operational content column. */
export function SupportHeader({ children, operational = false, headerRef, homeLabel }: {
  children?: ReactNode; operational?: boolean; headerRef?: Ref<HTMLElement>; homeLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <header ref={headerRef} className="support-header sticky top-0 z-30 border-b border-line/70 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className={`support-width support-brand ${operational ? 'support-operational' : ''}`}>
        <span className="flex min-w-0 items-center gap-2">
          <Link to="/" aria-label={homeLabel ?? t('common.app_name')}><Wordmark /></Link>
          <Logo className="h-7 sm:h-8" />
        </span>
        <div className="flex shrink-0 items-center gap-1.5"><ThemeToggle /><LangToggle /></div>
      </div>
      {children}
    </header>
  )
}

export function PageReturn({ children, to, onClick }: { children: ReactNode; to?: string; onClick?: () => void }) {
  const content = <><ArrowLeft className="size-4 shrink-0" aria-hidden /><span className="language-text">{children}</span></>
  return to ? <Link to={to} className="support-return">{content}</Link>
    : <button type="button" onClick={onClick} className="support-return">{content}</button>
}

export function PageIntro({ title, description, icon: Icon, action }: {
  title: string; description: ReactNode; icon: LucideIcon; action?: ReactNode
}) {
  return (
    <div className="support-intro">
      <span className="support-intro-icon"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h1 className="support-title"><span className="language-text">{title}</span></h1>
        <div className="support-description">{description}</div>
      </div>
      {action && <div className="support-intro-action">{action}</div>}
    </div>
  )
}
