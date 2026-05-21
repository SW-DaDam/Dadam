// useSeniorVoiceSettings 테스트
// 핵심 검증 포인트:
// 1. DB에 마이그레이션 전 OpenAI voice ID('shimmer' 등)가 남아 있어도 기본값(ngoeun)으로 안전 폴백
// 2. loadSettings/saveSettings/playPreview/stopPreview 동작
// Phase 1: voice 1종(ngoeun)만 valid

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
      data: { tts_voice: 'ngoeun', tts_speed: 'normal' },
      error: null,
    })

    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { await result.current.loadSettings('user-123') })

    expect(result.current.settings).toEqual({ voice: 'ngoeun', speed: 'normal' })
    expect(result.current.error).toBeNull()
  })

  it('DB에 OpenAI 잔존 voice("shimmer")가 있으면 기본값(ngoeun)으로 폴백한다 — 마이그레이션 안전망', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { tts_voice: 'shimmer', tts_speed: 'slow' },
      error: null,
    })

    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { await result.current.loadSettings('user-123') })

    // voice는 폴백, speed는 유효하므로 그대로
    expect(result.current.settings).toEqual({ voice: 'ngoeun', speed: 'slow' })
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
      await result.current.saveSettings('user-123', { voice: 'ngoeun', speed: 'fast' })
    })
    expect(mockUpdate).toHaveBeenCalledWith({ tts_voice: 'ngoeun', tts_speed: 'fast' })
  })
})

describe('useSeniorVoiceSettings.playPreview', () => {
  it('playPreview 호출 시 audio.play()가 실행되고 playingKey가 설정된다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { result.current.playPreview('ngoeun', 'slow') })

    expect(mockAudioPlay).toHaveBeenCalled()
    expect(result.current.playingKey).toBe('ngoeun_slow')
  })

  it('동일 샘플 재클릭 시 audio.pause()로 정지된다', async () => {
    const { result } = renderHook(() => useSeniorVoiceSettings())
    await act(async () => { result.current.playPreview('ngoeun', 'slow') })
    await act(async () => { result.current.playPreview('ngoeun', 'slow') })
    expect(mockAudioPause).toHaveBeenCalled()
    expect(result.current.playingKey).toBeNull()
  })
})
