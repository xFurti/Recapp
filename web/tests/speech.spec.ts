import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, query = '', mode = 'ready') {
  await page.addInitScript(({ mode }) => {
    if (mode === 'unsupported') {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined })
      delete (window as any).SpeechSynthesisUtterance
      return
    }
    const voices = [
      { lang: 'it-IT', default: false }, { lang: 'en-GB', default: false }, { lang: 'fr-FR', default: true },
    ]
    const engine = new EventTarget() as any
    engine.voices = mode === 'empty' || mode === 'delayed' ? [] : mode === 'fallback' ? [voices[2]] : voices
    engine.requests = []
    engine.cancels = 0
    engine.getVoices = () => engine.voices
    engine.cancel = () => { engine.cancels++; engine.current = null }
    engine.speak = (utterance: any) => { engine.requests.push(utterance); engine.current = utterance }
    engine.pause = () => engine.current?.onpause?.()
    engine.resume = () => engine.current?.onresume?.()
    engine.start = () => engine.current?.onstart?.()
    engine.end = () => { const old = engine.current; engine.current = null; old?.onend?.() }
    engine.fail = () => engine.current?.onerror?.({ error: 'synthesis-failed' })
    engine.ready = () => { engine.voices = voices; engine.dispatchEvent(new Event('voiceschanged')) }
    Object.defineProperty(window, 'speechSynthesis', { value: engine })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { text: string; constructor(text: string) { this.text = text } } })
  }, { mode })
  await page.goto(`/tests/speech.html${query}`)
}
const engine = (page: Page, action: string) => page.evaluate(action => (window.speechSynthesis as any)[action](), action)
const first = (page: Page) => page.getByRole('region', { name: 'first' })

for (const lang of ['it', 'en']) {
  for (const long of [false, true]) {
    test(`${lang} ${long ? 'long' : 'short'} completes, rerenders and unrelated unmounts do not cancel`, async ({ page }) => {
      await setup(page, long ? '?long' : '')
      if (lang === 'en') { await page.evaluate(() => localStorage.setItem('ieri.lang', 'en')); await page.reload() }
      await first(page).getByRole('button').click()
      await expect(first(page).getByRole('button').first()).toBeDisabled()
      await engine(page, 'start')
      await page.getByRole('button', { name: 'Rerender' }).click()
      await page.getByRole('button', { name: 'Unmount other' }).click()
      expect(await page.evaluate(() => (window.speechSynthesis as any).cancels)).toBe(0)
      expect(await page.evaluate(() => (window.speechSynthesis as any).current.voice.lang)).toBe(lang === 'it' ? 'it-IT' : 'en-GB')
      const result = await page.evaluate(() => {
        const e = window.speechSynthesis as any
        while (e.current && e.requests.length < 100) { e.start(); e.end() }
        return e.requests.map((u: any) => u.text)
      })
      expect(result.every((text: string) => [...text].length <= 181)).toBe(true)
      expect(result.join('')).toContain(long ? 'Una frase lunga. '.repeat(100) : 'Una frase breve.')
      await expect(first(page).getByRole('button', { name: lang === 'it' ? 'Ascolta' : 'Listen' })).toBeVisible()
    })
  }
}

test('pause, resume, stop, restart and stale callbacks', async ({ page }) => {
  await setup(page)
  await first(page).getByRole('button').click()
  await engine(page, 'start')
  await first(page).getByRole('button', { name: 'Pausa' }).click()
  await expect(first(page).getByRole('button', { name: 'Riprendi' })).toBeVisible()
  await first(page).getByRole('button', { name: 'Riprendi' }).click()
  await page.evaluate(() => { (window as any).old = (window.speechSynthesis as any).current })
  await first(page).getByRole('button', { name: 'Stop' }).click()
  await first(page).getByRole('button', { name: 'Ascolta' }).evaluate((b: HTMLButtonElement) => { b.click(); b.click() })
  await engine(page, 'start')
  await page.evaluate(() => { (window as any).old.onend(); (window as any).old.onerror() })
  await expect(first(page).getByRole('button', { name: 'Pausa' })).toBeVisible()
  expect(await page.evaluate(() => (window.speechSynthesis as any).requests.length)).toBe(2)
  await page.getByRole('button', { name: 'Unmount active' }).click()
  expect(await page.evaluate(() => (window.speechSynthesis as any).cancels)).toBe(2)
})

test('another card takes ownership without overlapping', async ({ page }) => {
  await setup(page)
  await first(page).getByRole('button').click(); await engine(page, 'start')
  await page.getByRole('region', { name: 'second' }).getByRole('button').click()
  await expect(first(page).getByRole('button', { name: 'Ascolta' })).toBeVisible()
  expect(await page.evaluate(() => (window.speechSynthesis as any).cancels)).toBe(1)
  await page.getByRole('button', { name: 'Unmount active' }).click()
  expect(await page.evaluate(() => (window.speechSynthesis as any).cancels)).toBe(1)
})

for (const mode of ['empty', 'delayed', 'fallback', 'unsupported']) {
  test(`voices: ${mode}`, async ({ page }) => {
    await setup(page, '', mode)
    if (mode === 'unsupported') { await expect(first(page).getByRole('status')).toContainText('non supporta'); return }
    await first(page).getByRole('button').click()
    if (mode === 'empty') { await expect(first(page).getByRole('alert')).toContainText('Nessuna voce', { timeout: 5000 }); return }
    if (mode === 'delayed') { await expect(first(page).getByRole('button').first()).toBeDisabled(); await engine(page, 'ready') }
    await engine(page, 'start')
    await expect(first(page).getByRole('button', { name: 'Pausa' })).toBeVisible()
    await engine(page, 'fail')
    await expect(first(page).getByRole('alert')).toContainText('Non è stato possibile')
    await first(page).getByRole('button', { name: 'Ascolta' }).click()
    await expect(first(page).getByRole('alert')).toHaveCount(0)
  })
}

test('silent startup failure is visible and cancellable', async ({ page }) => {
  await setup(page)
  await first(page).getByRole('button').click()
  await expect(first(page).getByRole('alert')).toContainText('Non è stato possibile', { timeout: 12000 })
})

test('stop while waiting removes delayed voice callbacks', async ({ page }) => {
  await setup(page, '', 'delayed')
  await first(page).getByRole('button').click()
  await first(page).getByRole('button', { name: 'Stop' }).click()
  await engine(page, 'ready')
  expect(await page.evaluate(() => (window.speechSynthesis as any).requests.length)).toBe(0)
  await expect(first(page).getByRole('button', { name: 'Ascolta' })).toBeVisible()
  await expect(first(page).getByRole('alert')).toHaveCount(0)
})
