import { Check, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './ui'

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
        <span className={`min-w-0 flex-1 break-all ${mono ? 'font-mono text-lg font-bold tracking-widest' : 'text-sm'}`}>{value}</span>
        <button onClick={copy} className="shrink-0 rounded-lg p-1.5 hover:bg-ink/5" aria-label={t('common.copy')} title={copied ? t('common.copied') : t('common.copy')}>
          {copied ? <Check className="size-4 text-verde-ink" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  )
}

export function InviteModal({
  open, onClose, nick, invite, joinUrl, classCode,
}: {
  open: boolean
  onClose: () => void
  nick: string
  invite: string
  joinUrl: string
  classCode: string
}) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={t('class.invite_title', { nick })}>
      <p className="mb-4 rounded-xl bg-giallo-soft px-3 py-2 text-sm font-semibold">{t('class.invite_once')}</p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <QRCodeSVG value={joinUrl} size={148} fgColor="#1d1b1e" />
        </div>
        <div className="w-full space-y-3">
          <CopyField label={t('join.invite_label')} value={invite} mono />
          <CopyField label={t('class.class_code')} value={classCode} mono />
        </div>
      </div>
      <div className="mt-3">
        <CopyField label="Link" value={joinUrl} />
      </div>
      <p className="mt-3 text-sm text-muted">{t('class.invite_steps', { nick })}</p>
    </Modal>
  )
}
