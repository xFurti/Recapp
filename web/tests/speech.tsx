import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ListenButton } from '../src/components/day'
import type { Card } from '../src/types'
import '../src/i18n'

const card = { day: '2026-10-01', author: { nick: 'Ada' }, entries: [], items: [], notes: new URLSearchParams(location.search).has('long') ? 'Una frase lunga. '.repeat(100) : 'Una frase breve.' } as Card
// Standalone test entry point; no Fast Refresh exports are needed.
// oxlint-disable-next-line react/only-export-components
function Fixture() {
  const [visible, setVisible] = useState(true)
  const [other, setOther] = useState(true)
  const [, rerender] = useState(0)
  return <>
    <button onClick={() => setVisible(false)}>Unmount active</button>
    <button onClick={() => setOther(false)}>Unmount other</button>
    <button onClick={() => rerender(n => n + 1)}>Rerender</button>
    <section aria-label="first">{visible && <ListenButton card={card} subjects={[]} />}</section>
    <section aria-label="second">{other && <ListenButton card={card} subjects={[]} />}</section>
  </>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>)
