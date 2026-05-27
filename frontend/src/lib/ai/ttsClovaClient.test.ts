// ttsClovaClient 테스트 — fetchTts/getSampleUrl/revokeObjectUrl 동작 검증

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchTts, getSampleUrl, revokeObjectUrl } from './ttsClovaClient'

// fetch · URL.createObjectURL · URL.revokeObjectURL 모킹 — Node 환경에 없음
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()
vi.stubGlobal('URL', {
  ...URL,
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

// import.meta.env.VITE_SUPABASE_URL 모킹
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe('fetchTts (Clova)', () => {
  it('정상 응답 시 Blob URL을 반환한다', async () => {
    const audioBlob = new Blob(['mp3-data'], { type: 'audio/mpeg' })
    mockFetch.mockResolvedValueOnce(new Response(audioBlob, { status: 200 }))

    const url = await fetchTts('안녕하세요', 'noyj', 'normal', 'token-abc')
    expect(url).toBe('blob:mock-url')
    expect(mockCreateObjectURL).toHaveBeenCalledOnce()
  })

  it('tts-clova endpoint로 POST 호출한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response(new Blob(['ok']), { status: 200 }))
    await fetchTts('테스트', 'noyj', 'normal', 'my-token')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/tts-clova',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('Authorization Bearer + JSON Content-Type 헤더를 포함한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response(new Blob(['ok']), { status: 200 }))
    await fetchTts('테스트', 'noyj', 'normal', 'my-token')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('요청 body에 text·voice·speed를 JSON으로 전달한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response(new Blob(['ok']), { status: 200 }))
    await fetchTts('안녕', 'vara', 'fast', 'tk')
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit
    expect(JSON.parse(callArgs.body as string)).toEqual({
      text: '안녕',
      voice: 'vara',
      speed: 'fast',
    })
  })

  it('401 응답 시 즉시 throw하고 재시도하지 않는다', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 401 }))
    await expect(fetchTts('x', 'noyj', 'slow', 'bad')).rejects.toThrow('401')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('403 응답 시 즉시 throw하고 재시도하지 않는다', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 403 }))
    await expect(fetchTts('x', 'noyj', 'slow', 'bad')).rejects.toThrow('403')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('422 응답 시 즉시 throw하고 재시도하지 않는다', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 422 }))
    await expect(fetchTts('x', 'noyj', 'slow', 'bad')).rejects.toThrow('422')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('502 응답 시 재시도(최초 1회 + 2회 재시도) 후 throw한다', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(new Response(null, { status: 502 }))
    const assertion = expect(fetchTts('x', 'noyj', 'slow', 'tk')).rejects.toThrow()
    await vi.runAllTimersAsync()
    await assertion
    // MAX_RETRY_COUNT = 2 → 최초 1회 + 재시도 2회 = 3회
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})

describe('getSampleUrl', () => {
  it('voice·speed 조합으로 tts-samples Storage public URL을 반환한다', () => {
    const url = getSampleUrl('noyj', 'normal')
    expect(url).toBe('https://test.supabase.co/storage/v1/object/public/tts-samples/noyj_normal.mp3')
  })

  it('6종 voice × 3 speed 모두 올바른 파일명을 만든다', () => {
    const voices = ['nyuna', 'noyj', 'vara', 'nminsang', 'nsiyoon', 'vian'] as const
    const speeds = ['slow', 'normal', 'fast'] as const
    for (const v of voices) {
      for (const s of speeds) {
        expect(getSampleUrl(v, s)).toBe(
          `https://test.supabase.co/storage/v1/object/public/tts-samples/${v}_${s}.mp3`,
        )
      }
    }
  })
})

describe('revokeObjectUrl', () => {
  it('blob: 스킴이면 URL.revokeObjectURL을 호출한다', () => {
    revokeObjectUrl('blob:abc-123')
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:abc-123')
  })

  it('blob:이 아니면 호출하지 않는다 (외부 URL 누락 보호)', () => {
    revokeObjectUrl('https://example.com/foo.mp3')
    expect(mockRevokeObjectURL).not.toHaveBeenCalled()
  })
})
