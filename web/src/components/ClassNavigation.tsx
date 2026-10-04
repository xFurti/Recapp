import { CalendarClock, History, Sun, Users, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'
import { sectionIndex, sectionPaths } from '../lib/sections'
import { NavIcon, useNavIconMotion, type NavMotion } from './NavIcon'

type NavEntry = { icon: LucideIcon; motion: NavMotion; key: string; end?: boolean }

/** One entry per SECTIONS path, in the same order. */
const NAV: NavEntry[] = [
  { icon: Sun, motion: 'today', key: 'nav.today', end: true },
  { icon: History, motion: 'yesterday', key: 'nav.yesterday' },
  { icon: CalendarClock, motion: 'upcoming', key: 'nav.upcoming' },
  { icon: Users, motion: 'class', key: 'nav.class' },
]

function NavItem({ entry, to, mobile }: { entry: NavEntry; to: string; mobile: boolean }) {
  const { t } = useTranslation()
  const { playing, triggers } = useNavIconMotion()
  return (
    <NavLink
      to={to}
      end={entry.end}
      className={({ isActive }) => `section-nav-link relative z-10 rounded-xl ${mobile
        ? 'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold'
        : 'flex items-center gap-3 px-3 py-2.5 font-semibold'} ${isActive ? 'text-bordeaux' : 'text-muted hover:bg-ink/5 hover:text-ink'}`}
      data-tour={`nav-${entry.motion}`}
      {...triggers}
    >
      <NavIcon icon={entry.icon} motion={entry.motion} playing={playing} className={mobile ? 'size-6' : 'size-5'} />
      <span className="language-text">{t(entry.key)}</span>
    </NavLink>
  )
}

/** One decorative layer follows the current URL; CSS retargets an in-flight transition on rapid navigation. */
export function ClassNavigation({ code, mobile = false }: { code: string; mobile?: boolean }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const paths = sectionPaths(code)
  const selected = sectionIndex(pathname, code)
  return (
    <nav
      aria-label={t('nav.sections')}
      className={`section-nav relative isolate grid ${mobile ? 'section-nav-mobile mx-auto max-w-md grid-cols-4' : 'section-nav-desktop grid-rows-4 gap-1'}`}
      style={{ '--section-index': Math.max(0, selected) } as CSSProperties}
    >
      <span aria-hidden="true" className="section-nav-indicator pointer-events-none absolute rounded-xl bg-bordeaux-soft" hidden={selected < 0} />
      {NAV.map((entry, index) => <NavItem key={entry.key} entry={entry} to={paths[index]} mobile={mobile} />)}
    </nav>
  )
}
