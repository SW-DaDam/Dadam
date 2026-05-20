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

let mockSettingsState = { voice: 'shimmer' as const, speed: 'slow' as const }
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
  mockSettingsState = { voice: 'shimmer', speed: 'slow' }
  mockPlayingKey = null
  mockSaving = false
  mockLoading = false
  mockError = null
})

describe('AiVoiceSettingsPage', () => {
  it('6개 voice 카드가 렌더링된다', () => {
    renderPage()
    // 각 voice 이름이 카드로 표시되는지 확인
    expect(screen.getByText('따뜻한 목소리')).toBeTruthy()
    expect(screen.getByText('밝은 목소리')).toBeTruthy()
    expect(screen.getByText('부드러운 목소리')).toBeTruthy()
    expect(screen.getByText('깊은 목소리')).toBeTruthy()
    expect(screen.getByText('낮은 목소리')).toBeTruthy()
    expect(screen.getByText('지혜로운 목소리')).toBeTruthy()
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

  it('저장하기 버튼 클릭 시 saveSettings가 현재 선택으로 호출된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        { voice: 'shimmer', speed: 'slow' },
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

  it('loading=true 시 "불러오는 중…" 텍스트가 표시된다', () => {
    mockLoading = true
    renderPage()
    expect(screen.getByText('불러오는 중…')).toBeTruthy()
  })

  it('error가 있으면 에러 배너가 표시된다', () => {
    mockError = '설정을 불러오지 못했어요.'
    renderPage()
    expect(screen.getByText('설정을 불러오지 못했어요.')).toBeTruthy()
  })

  it('배너 들어보기 클릭 시 playPreview가 호출된다', () => {
    renderPage()
    // 배너의 들어보기 버튼 (첫 번째 들어보기 텍스트)
    const previewBtns = screen.getAllByText('들어보기')
    fireEvent.click(previewBtns[0])
    expect(mockPlayPreview).toHaveBeenCalledWith('shimmer', 'slow')
  })

  it('재생 중일 때 배너 버튼 클릭 시 stopPreview가 호출된다', () => {
    mockPlayingKey = 'shimmer_slow'
    renderPage()
    // 배너의 "정지" 버튼
    const stopBtns = screen.getAllByText('정지')
    fireEvent.click(stopBtns[0])
    expect(mockStopPreview).toHaveBeenCalled()
  })

  it('음량 섹션이 없고 기기 볼륨 안내 텍스트가 있다', () => {
    renderPage()
    expect(screen.getByText(/볼륨 키/)).toBeTruthy()
    expect(screen.queryByText('음량')).toBeNull()
  })
})

describe('AiVoiceSettingsPage — 목소리 카드 선택', () => {
  it('nova 카드 클릭 시 해당 카드가 활성화된다', () => {
    renderPage()
    // "밝은 목소리" 카드 버튼 클릭
    fireEvent.click(screen.getByText('밝은 목소리').closest('button')!)
    // 저장 시 nova가 선택된 상태로 호출됨
    fireEvent.click(screen.getByText('저장하기'))
    expect(mockSaveSettings).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ voice: 'nova' }),
    )
  })

  it('빠르게 속도 선택 후 저장 시 fast가 전달된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('빠르게'))
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ speed: 'fast' }),
      )
    })
  })
})
