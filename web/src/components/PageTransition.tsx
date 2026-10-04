import { Component, createRef, type ReactNode, type RefObject } from 'react'
import { PageCurtain, type Axis, type Direction } from '../lib/page-curtain'

type Props = {
  /** Changes only when the page changes: not for filters, days or subjects inside the same page. */
  page: string
  /** Position in the section navigation, or -1 off it; sets which way the wipe travels. */
  section: number
  header: RefObject<HTMLElement | null>
  bar: RefObject<HTMLElement | null>
  className: string
  children: ReactNode
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const historyIndex = () => (window.history.state as { idx?: number } | null)?.idx ?? 0

/**
 * Takes focus to the new page's heading (or the page itself), unless it has moved on since the
 * navigation started: to a dialog, a menu or another control.
 */
function focusPage(main: HTMLElement, opener: Element | null) {
  const active = document.activeElement
  if (active && active !== document.body && active !== opener && !main.contains(active)) return
  const target = main.querySelector<HTMLElement>('h1') ?? main
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1
  target.dataset.pageFocus = ''
  target.focus({ preventScroll: true })
}

/**
 * The page area of the class shell. A class component because the old page has to be copied in
 * getSnapshotBeforeUpdate, after the router commits the new URL but before React replaces the DOM:
 * the new page mounts (and starts loading) at once while its frozen predecessor is covered.
 */
export class PageFrame extends Component<Props> {
  private main = createRef<HTMLElement>()
  private layer = createRef<HTMLDivElement>()
  private old = createRef<HTMLDivElement>()
  private panel = createRef<HTMLDivElement>()
  private edge = createRef<HTMLDivElement>()
  private curtain: PageCurtain | null = null
  private index = historyIndex()
  /** What had focus when the latest navigation started. */
  private opener: Element | null = null

  componentDidMount() {
    const [layer, old, panel, edge] = [this.layer.current!, this.old.current!, this.panel.current!, this.edge.current!]
    this.curtain = new PageCurtain({ layer, old, panel, edge }, () => this.bounds(), () => {
      if (this.main.current) focusPage(this.main.current, this.opener)
    })
  }

  componentWillUnmount() {
    this.curtain?.stop()
  }

  getSnapshotBeforeUpdate(prev: Props) {
    const index = historyIndex()
    const back = index < this.index
    this.index = index
    const main = this.main.current
    if (prev.page === this.props.page || !main || !this.curtain) return false
    this.opener = document.activeElement
    if (reducedMotion()) {
      this.curtain.stop()
      return true
    }
    const { section } = this.props
    const dir: Direction = prev.section >= 0 && section >= 0 ? (section > prev.section ? 1 : -1) : back ? -1 : 1
    // Travel along the navigation that drives it: down the sidebar, across the phone tab bar.
    const axis: Axis = window.matchMedia('(min-width: 768px)').matches ? 'y' : 'x'
    this.curtain.cover(main, axis, dir)
    return true
  }

  componentDidUpdate(_prev: Props, _state: unknown, changed: boolean) {
    // Without a wipe the page changes at once; with one, focus moves when the curtain opens.
    if (changed && !this.curtain?.running && this.main.current) focusPage(this.main.current, this.opener)
  }

  /** The visible page area, between the sticky header and the phone tab bar. */
  private bounds() {
    const top = Math.max(0, this.props.header.current?.getBoundingClientRect().bottom ?? 0)
    const bar = this.props.bar.current?.getBoundingClientRect()
    const bottom = bar && bar.height > 0 ? Math.max(0, window.innerHeight - bar.top) : 0
    return { top, bottom }
  }

  render() {
    return (
      <>
        <main ref={this.main} tabIndex={-1} className={this.props.className}>{this.props.children}</main>
        <div ref={this.layer} className="page-curtain" aria-hidden="true" hidden>
          <div ref={this.old} className="page-curtain-old" hidden />
          <div ref={this.edge} className="page-curtain-edge" />
          <div ref={this.panel} className="page-curtain-panel" />
        </div>
      </>
    )
  }
}
