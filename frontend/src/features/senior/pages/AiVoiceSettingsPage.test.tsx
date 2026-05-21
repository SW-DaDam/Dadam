// AiVoiceSettingsPage 테스트 (Phase 1)
// voice 카드 그리드는 제거되고 안내 박스로 대체됨 — Phase 2에서 6종 카드 복구 예정
// speed 섹션 · 미리듣기 배너 · 저장 바 · 음량 안내는 유지

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import AiVoiceSettingsPage from './AiVoiceSettingsPage'

// AuthStore 모킹 — userId 공급
vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { id: 'user-123' } }),
  ),
}))

// useSeniorVoiceSettings 모킹
const mockLoadSettings = vi.fn().mockResolvedValue(undefined)
const mockSaveSettings = vi.fn().mockResolvedValue(undefined)
const mockPlayPreview = vi.fn()
const mockStopPreview = vi.fn()
const mockSetSettings = vi.fn()

// Phase 1: voice는 항상 'ngoeun' 1종
let mockSettingsState = { voice: 'ngoeun' as const, speed: 'slow' as const }
let mockPlayingKey: string | null = null
let mockSaving = false
let mockLoading = false
let mockError: string | null = null

vi.mock('@/features/senior/hooks/useSeniorVoiceSettings', () => ({
  useSeniorVoiceSettings: () => ({
    settings: mockSettingsState,
    loading: mockLoading,
    saving: mockSaving,
    error: mockError,
    playingKey: mockPlayingKey,
    setSettings: mockSetSettings,
    loadSettings: mockLoadSettings,
    saveSettings: mockSaveSettings,
    playPreview: mockPlayPreview,
    stopPreview: mockStopPreview,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AiVoiceSettingsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSettingsState = { voice: 'ngoeun', speed: 'slow' }
  mockPlayingKey = null
  mockSaving = false
  mockLoading = false
  mockError = null
})

describe('AiVoiceSettingsPage — Phase 1 단일 voice 운영', () => {
  it('voice 안내 박스가 렌더링된다 ("곧 여러 종류" 문구 + "고은" 표시)', () => {
    renderPage()
    expect(screen.getByText(/곧 여러 종류 중에서/)).toBeTruthy()
    // "고은"은 미리듣기 배너와 안내 박스 두 곳에 나타남
    expect(screen.getAllByText(/고은/).length).toBeGreaterThanOrEqual(2)
  })

  it('Phase 2 예정인 OpenAI 카드 라벨은 없다 (예: "따뜻한 목소리")', () => {
    renderPage()
    expect(screen.queryByText('따뜻한 목소리')).toBeNull()
    expect(screen.queryByText('지혜로운 목소리')).toBeNull()
  })

  it('속도 옵션 3개가 렌더링된다', () => {
    renderPage()
    expect(screen.getByText('천천히')).toBeTruthy()
    expect(screen.getByText('보통')).toBeTruthy()
    expect(screen.getByText('빠르게')).toBeTruthy()
  })

  it('마운트 시 loadSettings가 userId로 호출된다', () => {
    renderPage()
    expect(mockLoadSettings).toHaveBeenCalledWith('user-123')
  })

  it('저장하기 버튼 클릭 시 saveSettings가 ngoeun + 현재 speed로 호출된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        { voice: 'ngoeun', speed: 'slow' },
      )
    })
  })

  it('저장 완료 후 "저장 완료!" 텍스트가 표시된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(screen.getByText('저장 완료!')).toBeTruthy()
    })
  })

  it('saving=true 시 저장 버튼이 disabled 상태다', () => {
    mockSaving = true
    renderPage()
    const saveBtn = screen.getByRole('button', { name: /저장 중/ })
    expect(saveBtn).toBeDisabled()
  })

  it('error가 있으면 에러 배너가 표시된다', () => {
    mockError = '설정을 불러오지 못했어요.'
    renderPage()
    expect(screen.getByText('설정을 불러오지 못했어요.')).toBeTruthy()
  })

  it('배너 들어보기 클릭 시 playPreview가 ngoeun + 현재 speed로 호출된다', () => {
    renderPage()
    const previewBtns = screen.getAllByText('들어보기')
    fireEvent.click(previewBtns[0])
    expect(mockPlayPreview).toHaveBeenCalledWith('ngoeun', 'slow')
  })

  it('재생 중일 때 배너 버튼 클릭 시 stopPreview가 호출된다', () => {
    mockPlayingKey = 'ngoeun_slow'
    renderPage()
    const stopBtns = screen.getAllByText('정지')
    fireEvent.click(stopBtns[0])
    expect(mockStopPreview).toHaveBeenCalled()
  })

  it('음량 섹션이 없고 기기 볼륨 안내 텍스트가 있다', () => {
    renderPage()
    expect(screen.getByText(/볼륨 키/)).toBeTruthy()
    expect(screen.queryByText('음량')).toBeNull()
  })

  it('빠르게 속도 선택 후 저장 시 speed=fast가 전달된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('빠르게'))
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ speed: 'fast', voice: 'ngoeun' }),
      )
    })
  })
})
