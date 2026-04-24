import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceChat } from './useVoiceChat'

// SpeechRecognition 모킹 — new SpeechRecognition() 호출을 지원하도록 class 형태로 작성
const mockRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  lang: '',
  interimResults: false,
  continuous: false,
  onresult: null as ((e: SpeechRecognitionEvent) => void) | null,
  onerror: null as ((e: SpeechRecognitionErrorEvent) => void) | null,
  onend: null as (() => void) | null,
}
class MockSpeechRecognition {
  start = mockRecognition.start
  stop = mockRecognition.stop
  lang = mockRecognition.lang
  interimResults = mockRecognition.interimResults
  continuous = mockRecognition.continuous
  set onresult(fn: ((e: SpeechRecognitionEvent) => void) | null) { mockRecognition.onresult = fn }
  set onerror(fn: ((e: SpeechRecognitionErrorEvent) => void) | null) { mockRecognition.onerror = fn }
  set onend(fn: (() => void) | null) { mockRecognition.onend = fn }
}
vi.stubGlobal('SpeechRecognition', MockSpeechRecognition)
vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)

// SpeechSynthesis 모킹
const mockUtteranceInstance = {
  lang: '',
  rate: 0,
  onend: null as (() => void) | null,
}
const mockSpeechSynthesis = { speak: vi.fn(), cancel: vi.fn() }
vi.stubGlobal('speechSynthesis', mockSpeechSynthesis)
vi.stubGlobal('SpeechSynthesisUtterance', vi.fn(() => mockUtteranceInstance))

// Supabase 모킹
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'conv-123' }, error: null }),
    })),
  },
}))

// voiceChatClient 모킹
vi.mock('@/lib/ai/voiceChatClient', () => ({
  streamVoiceChat: vi.fn().mockResolvedValue(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('안녕하세요'))
        c.close()
      },
    }),
  ),
}))

beforeEach(() => vi.clearAllMocks())

describe('useVoiceChat', () => {
  it('초기 state는 idle이고 messages는 비어 있다', () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    expect(result.current.state).toBe('idle')
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.transcript).toBe('')
  })

  it('startListening() 호출 시 state가 listening이 되고 recognition.start()가 호출된다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })
    expect(result.current.state).toBe('listening')
    expect(mockRecognition.start).toHaveBeenCalledOnce()
  })

  it('listening 중 stopListening() 호출 시 recognition.stop()이 호출된다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })
    await act(async () => { result.current.stopListening() })
    expect(mockRecognition.stop).toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
  })

  it('onresult 이벤트(isFinal=true) 발생 시 user 메시지가 messages에 추가된다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })
    await act(async () => {
      mockRecognition.onresult?.({
        results: [
          Object.assign([{ transcript: '안녕하세요', isFinal: true }], { isFinal: true }),
        ],
        resultIndex: 0,
      } as unknown as SpeechRecognitionEvent)
    })
    expect(result.current.messages.some((m) => m.role === 'user')).toBe(true)
  })

  it('not-allowed 에러 시 error 메시지가 설정되고 state가 idle로 돌아온다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })
    await act(async () => {
      mockRecognition.onerror?.({ error: 'not-allowed' } as SpeechRecognitionErrorEvent)
    })
    expect(result.current.error).toContain('마이크')
    expect(result.current.state).toBe('idle')
  })

  it('언마운트 시 recognition.stop()과 speechSynthesis.cancel()이 호출된다', async () => {
    const { unmount } = renderHook(() => useVoiceChat('user-123'))
    unmount()
    expect(mockRecognition.stop).toHaveBeenCalled()
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled()
  })
})
