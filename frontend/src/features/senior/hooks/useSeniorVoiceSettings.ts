// 어르신 TTS 설정 로드·저장·미리듣기 훅
// senior_profiles.tts_voice / tts_speed 컬럼과 tts-samples 버킷 연동
// Phase 1: voice 1종(ngoeun)만 운영. Phase 2 확장 시 VALID_VOICES 배열만 갱신.

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSampleUrl } from '@/lib/ai/ttsClovaClient'
import type { TtsVoice, TtsSpeed, TtsSettings, SpeechStyle } from '@/types/domain'

// DB에서 읽은 값을 TtsVoice/TtsSpeed/SpeechStyle로 좁히는 타입 가드
// Phase 2 확장 시 VALID_VOICES 배열에 6종 추가
const VALID_VOICES: TtsVoice[] = ['ngoeun']
const VALID_SPEEDS: TtsSpeed[] = ['slow', 'normal', 'fast']
const VALID_STYLES: SpeechStyle[] = ['counselor', 'friend']

function isVoice(v: string): v is TtsVoice { return (VALID_VOICES as string[]).includes(v) }
function isSpeed(s: string): s is TtsSpeed { return (VALID_SPEEDS as string[]).includes(s) }
function isStyle(s: string): s is SpeechStyle { return (VALID_STYLES as string[]).includes(s) }

// Phase 1 디폴트 — speech_style은 'counselor'(기존 동작 유지)
const DEFAULT_SETTINGS: TtsSettings = { voice: 'ngoeun', speed: 'slow', speech_style: 'counselor' }

interface UseSeniorVoiceSettingsReturn {
  settings: TtsSettings
  loading: boolean
  saving: boolean
  error: string | null
  playingKey: string | null           // "{voice}_{speed}" — 재생 중인 샘플 식별
  setSettings: (s: TtsSettings) => void
  loadSettings: (userId: string) => Promise<void>
  saveSettings: (userId: string, s: TtsSettings) => Promise<void>
  playPreview: (voice: TtsVoice, speed: TtsSpeed) => void
  stopPreview: () => void
}

export function useSeniorVoiceSettings(): UseSeniorVoiceSettingsReturn {
  const [settings, setSettings] = useState<TtsSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)

  // 현재 재생 중인 <audio> 참조 — 중복 재생 방지 및 정지에 사용
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // senior_profiles에서 tts_voice/tts_speed 로드
  const loadSettings = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('senior_profiles')
        .select('tts_voice, tts_speed, speech_style')
        .eq('id', userId)
        .single()

      if (dbError) throw dbError

      const voice = data?.tts_voice
      const speed = data?.tts_speed
      const style = data?.speech_style

      // DB 값이 유효한 경우에만 적용, 유효하지 않으면 디폴트 사용
      setSettings({
        voice: typeof voice === 'string' && isVoice(voice) ? voice : DEFAULT_SETTINGS.voice,
        speed: typeof speed === 'string' && isSpeed(speed) ? speed : DEFAULT_SETTINGS.speed,
        speech_style: typeof style === 'string' && isStyle(style) ? style : DEFAULT_SETTINGS.speech_style,
      })
    } catch {
      setError('설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }, [])

  // senior_profiles tts_voice/tts_speed 업데이트
  const saveSettings = useCallback(async (userId: string, s: TtsSettings) => {
    setSaving(true)
    setError(null)
    try {
      const { error: dbError } = await supabase
        .from('senior_profiles')
        .update({ tts_voice: s.voice, tts_speed: s.speed, speech_style: s.speech_style })
        .eq('id', userId)

      if (dbError) throw dbError
      setSettings(s)
    } catch {
      setError('저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [])

  // tts-samples 버킷의 사전 생성 MP3 재생
  // 동일 샘플 재클릭 시 정지, 다른 샘플 클릭 시 현재 정지 후 새 재생
  const playPreview = useCallback((voice: TtsVoice, speed: TtsSpeed) => {
    const key = `${voice}_${speed}`

    // 같은 샘플이 재생 중이면 정지
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingKey(null)
      if (playingKey === key) return
    }

    const audio = new Audio(getSampleUrl(voice, speed))
    audioRef.current = audio

    audio.onended = () => {
      audioRef.current = null
      setPlayingKey(null)
    }
    audio.onerror = () => {
      audioRef.current = null
      setPlayingKey(null)
    }

    setPlayingKey(key)
    audio.play().catch(() => {
      audioRef.current = null
      setPlayingKey(null)
    })
  }, [playingKey])

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingKey(null)
    }
  }, [])

  return {
    settings,
    loading,
    saving,
    error,
    playingKey,
    setSettings,
    loadSettings,
    saveSettings,
    playPreview,
    stopPreview,
  }
}
