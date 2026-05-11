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

// voiceChatClient 모킹 — 호출마다 새 ReadableStream 반환 (스트림 lock 방지)
vi.mock('@/lib/ai/voiceChatClient', () => ({
  streamVoiceChat: vi.fn().mockImplementation(() =>
    Promise.resolve(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('안녕하세요'))
          c.close()
        },
      }),
    ),
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

describe('TASK-09: 자동 복구', () => {
  it('no-speech 에러가 3회 발생하면 isFatalError가 true가 된다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })

    // no-speech 에러 3회 트리거
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        mockRecognition.onerror?.({ error: 'no-speech' } as SpeechRecognitionErrorEvent)
      })
    }

    expect(result.current.isFatalError).toBe(true)
    expect(result.current.error).toContain('연결할 수 없어요')
  })

  it('retryFromFatal() 호출 시 isFatalError가 false로 리셋된다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        mockRecognition.onerror?.({ error: 'no-speech' } as SpeechRecognitionErrorEvent)
      })
    }
    expect(result.current.isFatalError).toBe(true)

    await act(async () => { result.current.retryFromFatal() })
    expect(result.current.isFatalError).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('no-speech가 2회 이하면 isFatalError가 false로 유지된다', async () => {
    const { result } = renderHook(() => useVoiceChat('user-123'))
    await act(async () => { result.current.startListening() })

    for (let i = 0; i < 2; i++) {
      await act(async () => {
        mockRecognition.onerror?.({ error: 'no-speech' } as SpeechRecognitionErrorEvent)
      })
    }

    expect(result.current.isFatalError).toBe(false)
  })
})

describe('TASK-07: DB 저장 연동', () => {
  it('sendTextMessage 호출 시 conversations INSERT가 실행된다', async () => {
    const { supabase } = await import('@/lib/supabase')
    const { result } = renderHook(() => useVoiceChat('senior-id-1'))

    await act(async () => {
      await result.current.sendTextMessage('오늘 날씨 좋네요')
    })

    expect(supabase.from).toHaveBeenCalledWith('conversations')
  })

  it('sendTextMessage 호출 시 utterances INSERT가 speaker="senior"로 실행된다', async () => {
    const { supabase } = await import('@/lib/supabase')
    // utterances insert 호출 여부를 확인하기 위해 from 호출 내역 추적
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.from).mockImplementation((table: string): any => {
      if (table === 'utterances') {
        return { insert: insertMock }
      }
      // conversations: 기존 mock 유지
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'conv-123' }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
    })

    const { result } = renderHook(() => useVoiceChat('senior-id-1'))

    await act(async () => {
      await result.current.sendTextMessage('테스트 발화')
    })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ speaker: 'senior', content: '테스트 발화' }),
    )
  })

  it('AI 응답 수신 후 utterances INSERT가 speaker="ai"로 실행된다', async () => {
    const { supabase } = await import('@/lib/supabase')
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.from).mockImplementation((table: string): any => {
      if (table === 'utterances') {
        return { insert: insertMock }
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'conv-123' }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
    })

    const { result } = renderHook(() => useVoiceChat('senior-id-1'))

    await act(async () => {
      await result.current.sendTextMessage('안녕하세요')
    })

    // senior 발화 + ai 응답 총 2회 insert 호출
    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(insertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ speaker: 'ai' }),
    )
  })
})
