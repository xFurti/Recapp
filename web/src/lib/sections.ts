/** The four class sections in navigation order, as paths below the class; only the first must match exactly. */
export const SECTIONS = ['', 'ieri', 'in-arrivo', 'classe'] as const

export const sectionPaths = (code: string) => SECTIONS.map((to) => to ? `/c/${code}/${to}` : `/c/${code}`)

/** Index of the section the URL is on, or -1 off the four sections. */
export function sectionIndex(pathname: string, code: string) {
  const paths = sectionPaths(code)
  // Match NavLink's exact/end and segment-boundary rules, including trailing slashes.
  const current = pathname.toLowerCase()
  return paths.findIndex((path, index) => {
    const target = path.toLowerCase()
    return current === target || (index > 0 && current.startsWith(`${target}/`))
  })
}
