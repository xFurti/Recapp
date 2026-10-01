import { useCallback, useState } from 'react'

const key = (code: string) => `ieri.done.${code}`

function read(code: string): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key(code)) ?? '[]') as number[])
  } catch {
    return new Set()
  }
}

/** Personal "done" marks, stored only on this device. */
export function useDone(code: string) {
  const [done, setDone] = useState<Set<number>>(() => read(code))
  const toggle = useCallback(
    (id: number) => {
      setDone((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        localStorage.setItem(key(code), JSON.stringify([...next]))
        return next
      })
    },
    [code],
  )
  return { done, toggle }
}
