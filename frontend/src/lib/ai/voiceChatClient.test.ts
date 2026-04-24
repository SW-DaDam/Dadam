import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamVoiceChat } from './voiceChatClient'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(text))
      c.close()
    },
  })
}

beforeEach(() => vi.clearAllMocks())

describe('streamVoiceChat', () => {
  it('성공 시 ReadableStream을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response(makeStream('안녕'), { status: 200 }))
    const stream = await streamVoiceChat([{ role: 'user', content: '안녕' }], 'test-token')
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('Authorization 헤더에 Bearer 토큰을 포함한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response(makeStream('ok'), { status: 200 }))
    await streamVoiceChat([{ role: 'user', content: '테스트' }], 'my-token')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      }),
    )
  })

  it('401 응답 시 즉시 throw하고 재시도하지 않는다', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 401 }))
    await expect(streamVoiceChat([], 'bad')).rejects.toThrow('401')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('403 응답 시 즉시 throw하고 재시도하지 않는다', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 403 }))
    await expect(streamVoiceChat([], 'bad')).rejects.toThrow('403')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('500 응답 시 3회 재시도 후 throw한다', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))
    // promise를 expect로 바로 감싸야 rejection이 처리된 것으로 인식된다
    const assertion = expect(streamVoiceChat([], 'token')).rejects.toThrow()
    await vi.runAllTimersAsync()
    await assertion
    // 최초 1회 + 재시도 3회 = 4회
    expect(mockFetch).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })
})
