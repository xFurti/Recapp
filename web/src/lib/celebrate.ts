const KEY = 'recapp.celebrate'

/** Remember that the next screen should throw confetti. Survives the route change after publish. */
export function queueCelebrate() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* private mode */
  }
}

export function takeCelebrate() {
  try {
    if (sessionStorage.getItem(KEY) !== '1') return false
    sessionStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}
