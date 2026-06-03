// ChatPage 테스트 — 텍스트 전송 즉시 입력창 초기화
// jsdom이 scrollIntoView를 지원하지 않으므로 전역 polyfill 추가
window.HTMLElement.prototype.scrollIntoView = vi.fn()

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ChatPage from './ChatPage'

const mockSendTextMessage = vi.fn()

vi.mock('@/features/chat/hooks/useVoiceChat', () => ({
  useVoiceChat: () => ({
    state: 'idle',
    messages: [],
    transcript: '',
    error: null,
    isSttSupported: false,
    isFatalError: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    sendTextMessage: mockSendTextMessage,
    retryFromFatal: vi.fn(),
  }),
}))
vi.mock('@/features/senior/hooks/useTodayConversationCount', () => ({
  useTodayConversationCount: () => ({ todayCount: 0, loading: false }),
}))
vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { id: 'user-1' } }),
  ),
}))

function renderPage() {
  return render(<MemoryRouter><ChatPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  // sendTextMessage가 즉시 resolve하도록 — AI 응답 대기 없이
  mockSendTextMessage.mockResolvedValue(undefined)
})

describe('ChatPage — 텍스트 입력 즉시 초기화', () => {
  it('전송 버튼 클릭 직후(AI 응답 전) 입력창이 비워진다', async () => {
    // sendTextMessage가 절대 resolve되지 않는 Promise (AI 응답 대기 시뮬레이션)
    mockSendTextMessage.mockReturnValue(new Promise(() => {}))

    renderPage()
    const input = screen.getByPlaceholderText('여기에 말씀을 입력해 주세요') as HTMLInputElement

    fireEvent.change(input, { target: { value: '안녕하세요' } })
    expect(input.value).toBe('안녕하세요')

    fireEvent.click(screen.getByRole('button', { name: '전송' }))

    // AI 응답 완료를 기다리지 않고도 입력창이 즉시 비워져야 함
    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('빈 입력은 전송되지 않는다', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '전송' }))
    expect(mockSendTextMessage).not.toHaveBeenCalled()
  })
})
