// useSeniorVoiceSettings 테스트
// 핵심 검증 포인트:
// 1. loadSettings: 유효 voice 적용, 유효하지 않은 voice는 디폴트(vara)로 폴백
// 2. saveSettings: DB update payload 검증
// 3. playPreview/stopPreview: audio 제어 검증

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSeniorVoiceSettings } from './useSeniorVoiceSettings'

// Supabase mock — chain된 from().select().eq().single() 패턴 지원
const mockSingle = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
      update: vi.fn((payload) => {
        mockUpdate(payload)
        return { eq: vi.fn().mockResolvedValue({ error: null }) }
      }),
    })),
  },
}))

// ttsClovaClient.getSampleUrl mock — 단순 URL 조합만 검증
vi.mock('@/lib/ai/ttsClovaClient', () => ({
  getSampleUrl: (voice: string, speed: string) =>
    `https://test/storage/${voice}_${speed}.mp3`,
}))

// Audio mock — playPreview 동작 검증을 위해 play/pause/onended 추적
const mockAudioPlay = vi.fn().mockResolvedValue(undefined)
const mockAudioPause = vi.fn()
class MockAudio {
  src: string
  play = mockAudioPlay
  pause = mockAudioPause
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(src: string) {
    this.src = src
  }
}
vi.stubGlobal('Audio', MockAudio)

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockReset()
})

describe('useSeniorVoiceSettings.loadSettings', () => {
  it('DB에 유효한 voice/speed가 있으면 그대로 적용한다', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { tts_voice: 'noyj', tts_speed: 'normal', speech_style: 'counselor' },
      error: null,
    })

    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { await result.current.loadSettings('user-123') })

    expect(result.current.settings).toEqual({ voice: 'noyj', speed: 'normal', speech_style: 'counselor' })
    expect(result.current.error).toBeNull()
  })

  it('6종 voice 모두 유효한 값으로 적용된다', async () => {
    const validVoices = ['nyuna', 'noyj', 'vara', 'nminsang', 'nsiyoon', 'vian'] as const

    for (const voice of validVoices) {
      mockSingle.mockResolvedValueOnce({
        data: { tts_voice: voice, tts_speed: 'normal', speech_style: 'counselor' },
        error: null,
      })
      const { result } = renderHook(() => useSeniorVoiceSettings())
      await act(async () => { await result.current.loadSettings('user-123') })
      expect(result.current.settings.voice).toBe(voice)
    }
  })

  it('DB에 유효하지 않은 voice가 있으면 기본값(vara)으로 폴백한다', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { tts_voice: 'unknown_voice', tts_speed: 'normal', speech_style: 'counselor' },
      error: null,
    })

    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { await result.current.loadSettings('user-123') })

    expect(result.current.settings.voice).toBe('vara')
  })

  it('DB 조회 에러 시 에러 메시지를 설정한다', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'db error', code: 'PGRST500' },
    })

    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { await result.current.loadSettings('user-123') })

    expect(result.current.error).toBe('설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  })
})

describe('useSeniorVoiceSettings.saveSettings', () => {
  it('saveSettings 호출 시 update가 voice/speed payload로 호출된다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => {
      await result.current.saveSettings('user-123', { voice: 'vara', speed: 'fast', speech_style: 'friend' })
    })
    expect(mockUpdate).toHaveBeenCalledWith({ tts_voice: 'vara', tts_speed: 'fast', speech_style: 'friend' })
  })

  it('봄달(noyj) + normal 저장 시 올바른 payload로 호출된다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => {
      await result.current.saveSettings('user-123', { voice: 'noyj', speed: 'normal', speech_style: 'counselor' })
    })
    expect(mockUpdate).toHaveBeenCalledWith({ tts_voice: 'noyj', tts_speed: 'normal', speech_style: 'counselor' })
  })
})

describe('useSeniorVoiceSettings.playPreview', () => {
  it('playPreview 호출 시 audio.play()가 실행되고 playingKey가 설정된다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { result.current.playPreview('noyj', 'normal') })

    expect(mockAudioPlay).toHaveBeenCalled()
    expect(result.current.playingKey).toBe('noyj_normal')
  })

  it('동일 샘플 재클릭 시 audio.pause()로 정지된다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { result.current.playPreview('vian', 'slow') })
    await act(async () => { result.current.playPreview('vian', 'slow') })
    expect(mockAudioPause).toHaveBeenCalled()
    expect(result.current.playingKey).toBeNull()
  })

  it('다른 voice 카드 클릭 시 기존 audio를 정지하고 새 audio를 재생한다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { result.current.playPreview('nyuna', 'normal') })
    expect(result.current.playingKey).toBe('nyuna_normal')

    await act(async () => { result.current.playPreview('nminsang', 'normal') })
    expect(mockAudioPause).toHaveBeenCalledTimes(1) // 기존 정지
    expect(result.current.playingKey).toBe('nminsang_normal')
  })
})
