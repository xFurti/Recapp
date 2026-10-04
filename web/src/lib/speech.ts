import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechState = 'idle' | 'loading' | 'playing' | 'paused'
export type SpeechError = 'unavailable' | 'failed'

// The browser has one global queue: only its owner may cancel it.
let activeStop: (() => void) | undefined

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const [state, setState] = useState<SpeechState>('idle')
  const [error, setError] = useState<SpeechError | null>(null)
  // Keep the utterance alive until the native engine finishes with it.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const session = useRef<(() => void) | undefined>(undefined)
  const paused = useRef(false)

  const stop = useCallback(() => session.current?.(), [])

  useEffect(() => {
    // Trigger asynchronous voice discovery before the first user interaction.
    if (supported) window.speechSynthesis.getVoices()
    return () => session.current?.()
  }, [supported])

  const play = useCallback((text: string, lang: string) => {
    if (!supported || session.current) return
    setError(null)
    if (!text.trim()) return
    activeStop?.()
    const synth = window.speechSynthesis
    const locale = lang.startsWith('en') ? 'en-US' : 'it-IT'
    // Short requests avoid desktop engines truncating long summaries. Preserve
    // every character, preferring word boundaries and respecting Unicode.
    const chunks = text.match(/[\s\S]{1,180}(?:\s|$)|[\s\S]{1,180}/gu) ?? []
    let index = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    paused.current = false

    const clearWaiting = () => {
      clearTimeout(timer)
      synth.removeEventListener('voiceschanged', start)
    }
    const finish = (cancel = false, failure: SpeechError | null = null) => {
      if (session.current !== cancelSession) return
      clearWaiting()
      session.current = undefined
      if (activeStop === cancelSession) activeStop = undefined
      // Invalidate callbacks before cancel(), whose events can arrive later.
      utteranceRef.current = null
      paused.current = false
      if (cancel) synth.cancel()
      setState('idle')
      setError(failure)
    }
    const cancelSession = () => finish(true)
    session.current = cancelSession
    activeStop = cancelSession
    setState('loading')

    const speakNext = (voice: SpeechSynthesisVoice) => {
      if (session.current !== cancelSession) return
      if (index === chunks.length) { finish(); return }
      const utterance = new SpeechSynthesisUtterance(chunks[index++])
      utteranceRef.current = utterance
      utterance.lang = locale
      utterance.voice = voice
      utterance.rate = 0.98
      const current = () => session.current === cancelSession && utteranceRef.current === utterance
      utterance.onstart = () => { if (current()) { clearTimeout(timer); setState(paused.current ? 'paused' : 'playing') } }
      utterance.onpause = () => { if (current()) { paused.current = true; setState('paused') } }
      utterance.onresume = () => { if (current()) { paused.current = false; setState('playing') } }
      utterance.onend = () => { if (current()) { clearTimeout(timer); speakNext(voice) } }
      utterance.onerror = () => { if (current()) finish(true, 'failed') }
      timer = setTimeout(() => { if (current()) finish(true, 'failed') }, 10000)
      try { synth.speak(utterance) } catch { finish(true, 'failed') }
    }
    function start() {
      if (session.current !== cancelSession) return
      const voices = synth.getVoices()
      if (!voices.length) return
      clearWaiting()
      const voice = voices.find(v => v.lang.toLowerCase() === locale.toLowerCase())
        ?? voices.find(v => v.lang.toLowerCase().startsWith(locale.slice(0, 2)))
        ?? voices.find(v => v.default) ?? voices[0]
      // cancel() does not reset a previously paused global engine.
      synth.resume()
      speakNext(voice)
    }
    synth.addEventListener('voiceschanged', start)
    timer = setTimeout(() => finish(true, 'unavailable'), 3000)
    start()
  }, [supported])

  const pause = useCallback(() => {
    if (!session.current || !utteranceRef.current) return
    window.speechSynthesis.pause()
  }, [])

  const resume = useCallback(() => {
    if (!session.current || !utteranceRef.current) return
    window.speechSynthesis.resume()
  }, [])

  return { supported, state, error, play, pause, resume, stop }
}
