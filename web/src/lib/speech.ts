import { useCallback, useEffect, useState } from 'react'

export type SpeechState = 'idle' | 'playing' | 'paused'

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [state, setState] = useState<SpeechState>('idle')

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  const play = useCallback(
    (text: string, lang: string) => {
      if (!supported) return
      const synth = window.speechSynthesis
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === 'en' ? 'en-US' : 'it-IT'
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2)))
      if (voice) utterance.voice = voice
      utterance.rate = 0.98
      utterance.onend = () => setState('idle')
      utterance.onerror = () => setState('idle')
      synth.speak(utterance)
      setState('playing')
    },
    [supported],
  )

  const pause = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.pause()
    setState('paused')
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.resume()
    setState('playing')
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setState('idle')
  }, [supported])

  return { supported, state, play, pause, resume, stop }
}
