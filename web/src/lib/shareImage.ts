import marconiLogo from '../assets/marconi-logo.png'

export interface ShareImageData {
  classLabel: string
  dayLabel: string
  subjects: { name: string; color: string }[]
  items: { typeLabel: string; title: string; when: string; color: string }[]
  url: string
  texts: { did: string; upcoming: string; none: string; cta: string }
}

const W = 1080
const H = 1350
const FONT = "'Inter Variable', Inter, system-ui, sans-serif"
const STAIRS = ['#A02848', '#F8B828', '#1898C8', '#80B830', '#E01058', '#8038B8']

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** 1080x1350 card for WhatsApp: subjects and deadlines only, never nicknames or notes. */
export async function renderShareImage(d: ShareImageData): Promise<Blob> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f6f4f1'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#A02848'
  ctx.fillRect(0, 0, W, 330)
  STAIRS.forEach((c, i) => {
    ctx.fillStyle = c
    const h = 40 + i * 22
    ctx.fillRect(760 + i * 50, 330 - h, 40, h)
  })

  try {
    const logo = await loadImage(marconiLogo)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(820, 50, 200, 120, 18)
    ctx.fill()
    const ratio = Math.min(176 / logo.width, 100 / logo.height)
    const lw = logo.width * ratio
    const lh = logo.height * ratio
    ctx.drawImage(logo, 820 + (200 - lw) / 2, 50 + (120 - lh) / 2, lw, lh)
  } catch {
    // the card works without the school logo
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = `800 84px ${FONT}`
  ctx.fillText('Recapp', 80, 140)
  ctx.font = `600 40px ${FONT}`
  ctx.fillText(fit(ctx, d.classLabel, 680), 80, 205)
  ctx.font = `700 46px ${FONT}`
  ctx.fillText(fit(ctx, d.dayLabel, 660), 80, 270)

  let y = 420
  ctx.fillStyle = '#1d1b1e'
  ctx.font = `800 44px ${FONT}`
  ctx.fillText(d.texts.did, 80, y)
  y += 30
  ctx.font = `600 40px ${FONT}`
  for (const s of d.subjects.slice(0, 6)) {
    y += 62
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(98, y - 14, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1d1b1e'
    ctx.fillText(fit(ctx, s.name, 860), 130, y)
  }
  if (d.subjects.length > 6) {
    y += 56
    ctx.fillStyle = '#6b6570'
    ctx.fillText(`+${d.subjects.length - 6}`, 130, y)
  }

  y += 100
  ctx.fillStyle = '#1d1b1e'
  ctx.font = `800 44px ${FONT}`
  ctx.fillText(d.texts.upcoming, 80, y)
  y += 20
  if (d.items.length === 0) {
    y += 60
    ctx.fillStyle = '#6b6570'
    ctx.font = `500 36px ${FONT}`
    ctx.fillText(d.texts.none, 80, y)
  }
  for (const it of d.items.slice(0, 4)) {
    y += 78
    ctx.font = `700 30px ${FONT}`
    const pill = ctx.measureText(it.typeLabel).width + 36
    ctx.fillStyle = it.color
    ctx.beginPath()
    ctx.roundRect(80, y - 40, pill, 52, 26)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(it.typeLabel, 98, y - 3)
    ctx.fillStyle = '#1d1b1e'
    ctx.font = `600 36px ${FONT}`
    ctx.fillText(fit(ctx, it.title, 900 - pill - 220), 100 + pill, y - 2)
    ctx.fillStyle = '#6b6570'
    ctx.font = `600 32px ${FONT}`
    const whenW = ctx.measureText(it.when).width
    ctx.fillText(it.when, W - 80 - whenW, y - 2)
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 1110, W, 240)
  ctx.fillStyle = '#A02848'
  ctx.fillRect(0, 1110, W, 8)
  ctx.font = `800 42px ${FONT}`
  let cy = 1185
  for (const line of wrap(ctx, d.texts.cta, W - 160).slice(0, 2)) {
    ctx.fillText(line, 80, cy)
    cy += 54
  }
  ctx.fillStyle = '#6b6570'
  ctx.font = `600 32px ${FONT}`
  ctx.fillText(fit(ctx, d.url.replace(/^https?:\/\//, ''), W - 160), 80, cy + 10)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'))
}

/** Native share sheet with the image when supported, otherwise download + WhatsApp link. */
export async function shareImage(blob: Blob, filename: string, text: string, url: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const message = `${text} ${url}`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  return 'downloaded'
}
