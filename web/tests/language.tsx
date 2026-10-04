import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { BrowserRouter } from 'react-router'
import { AppShell, LangToggle } from '../src/components/shell'
import { TranslatedMessage } from '../src/components/TranslatedMessage'
import { Button, Field, Modal, inputClass } from '../src/components/ui'
import type { ClassInfo } from '../src/types'
import '../src/i18n'
import '../src/lib/theme'
import '../src/index.css'

const info: ClassInfo = {
  code: 'TEST', name: 'Language test', label: '4ª CI — appunti di Ada', is_demo: false, subjects: [], hours: [],
  viewer: { kind: 'member', member: { id: 1, nick: 'Ada', color: '#a02848', role: 'admin' }, can_manage: true, read_only: false, tour_seen: true },
}
// oxlint-disable-next-line react/only-export-components
function Preview() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('Un appunto scritto da Ada.')
  return <AppShell info={info}>
    <div className="mb-4 sm:hidden"><LangToggle /></div>
    <h1 className="text-3xl font-extrabold"><span className="language-text">{t('nav.today')}</span></h1>
    <p className="mt-3 text-muted"><span className="language-text">{t('landing.subtitle')}</span></p>
    <p data-testid="mixed" className="mt-3"><TranslatedMessage message="banner.published" values={{ nick: 'Ada', time: '10:30' }} /></p>
    <p data-testid="authored" className="mt-3">Il riepilogo e i messaggi restano sempre visibili.</p>
    <Field label={t('day.notes')}><textarea className={inputClass} aria-label="Draft" placeholder={t('editor.notes_ph')} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
    <Button className="mt-4" onClick={() => setOpen(true)}><span className="language-text">{t('shell.change_pin')}</span></Button>
    <div className="h-[900px]" />
    <Modal open={open} onClose={() => setOpen(false)} title={t('shell.change_pin')}>
      <div className="mb-3 flex justify-end"><LangToggle /></div>
      <Field label={t('shell.old_pin')}><input className={inputClass} aria-label="PIN draft" defaultValue="1234" /></Field>
      <p className="mt-3 text-muted"><span className="language-text">{t('join.pin_sub')}</span></p>
    </Modal>
  </AppShell>
}
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter><Preview /></BrowserRouter></QueryClientProvider></StrictMode>)
