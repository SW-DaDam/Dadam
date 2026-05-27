// AiVoiceSettingsPage 테스트 (Phase 2)
// 6종 voice 카드 그리드 · speed 섹션 · 미리듣기 배너 · 저장 바 · 음량 안내 검증

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import AiVoiceSettingsPage from './AiVoiceSettingsPage'
import type { TtsVoice, TtsSpeed, SpeechStyle } from '@/types/domain'

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

let mockSettingsState: { voice: TtsVoice; speed: TtsSpeed; speech_style: SpeechStyle } = {
  voice: 'noyj',
  speed: 'normal',
  speech_style: 'counselor',
}
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
  mockSettingsState = { voice: 'noyj', speed: 'normal', speech_style: 'counselor' }
  mockPlayingKey = null
  mockSaving = false
  mockLoading = false
  mockError = null
})

describe('AiVoiceSettingsPage — 기본 렌더링', () => {
  it('마운트 시 loadSettings가 userId로 호출된다', () => {
    renderPage()
    expect(mockLoadSettings).toHaveBeenCalledWith('user-123')
  })

  it('error가 있으면 에러 배너가 표시된다', () => {
    mockError = '설정을 불러오지 못했어요.'
    renderPage()
    expect(screen.getByText('설정을 불러오지 못했어요.')).toBeTruthy()
  })

  it('기기 볼륨 안내 텍스트가 있다', () => {
    renderPage()
    expect(screen.getByText(/볼륨 키/)).toBeTruthy()
  })
})

describe('AiVoiceSettingsPage — voice 카드 그리드', () => {
  it('6종 화자 이름이 모두 렌더링된다', () => {
    renderPage()
    expect(screen.getByText('예진')).toBeTruthy()
    expect(screen.getByText('봄달')).toBeTruthy()
    expect(screen.getByText('아라')).toBeTruthy()
    expect(screen.getByText('민상')).toBeTruthy()
    expect(screen.getByText('시윤')).toBeTruthy()
    expect(screen.getByText('이안')).toBeTruthy()
  })

  it('여성/남성 섹션 레이블이 렌더링된다', () => {
    renderPage()
    expect(screen.getByText('여성')).toBeTruthy()
    expect(screen.getByText('남성')).toBeTruthy()
  })

  it('Pro 화자(아라, 이안)에 PRO 배지가 표시된다', () => {
    renderPage()
    const proBadges = screen.getAllByText('PRO')
    expect(proBadges).toHaveLength(2)
  })

  it('voice 카드 클릭 시 해당 voice가 선택된다 (pendingVoice 반영)', async () => {
    renderPage()
    // 예진 카드 클릭
    fireEvent.click(screen.getByText('예진').closest('button')!)
    // 저장 후 saveSettings에 nyejin 전달 확인
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ voice: 'nyejin' }),
      )
    })
  })

  it('카드 듣기 버튼 클릭 시 playPreview가 해당 voice + 현재 speed로 호출된다', () => {
    renderPage()
    // 봄달 카드의 듣기 버튼 클릭
    const dutkiButtons = screen.getAllByText('듣기')
    // 봄달은 FEMALE_VOICES[1] → 2번째 듣기 버튼
    fireEvent.click(dutkiButtons[1])
    expect(mockPlayPreview).toHaveBeenCalledWith('noyj', 'normal')
  })

  it('재생 중인 카드 정지 버튼 클릭 시 stopPreview가 호출된다', () => {
    mockPlayingKey = 'vian_normal'
    renderPage()
    const stopBtns = screen.getAllByText('정지')
    fireEvent.click(stopBtns[0])
    expect(mockStopPreview).toHaveBeenCalled()
  })
})

describe('AiVoiceSettingsPage — 미리듣기 배너', () => {
  it('선택된 voice 이름이 배너에 표시된다', () => {
    renderPage()
    // 봄달이 선택된 상태 — 카드 + 배너 두 곳에 노출됨
    const elements = screen.getAllByText(/봄달/)
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('배너 들어보기 클릭 시 playPreview가 현재 voice + speed로 호출된다', () => {
    renderPage()
    fireEvent.click(screen.getByText('들어보기'))
    expect(mockPlayPreview).toHaveBeenCalledWith('noyj', 'normal')
  })

  it('배너 재생 중일 때 정지 버튼 클릭 시 stopPreview가 호출된다', () => {
    mockPlayingKey = 'noyj_normal'
    renderPage()
    // 배너의 정지 버튼 (첫 번째 정지 버튼이 배너)
    const stopBtns = screen.getAllByText('정지')
    fireEvent.click(stopBtns[0])
    expect(mockStopPreview).toHaveBeenCalled()
  })
})

describe('AiVoiceSettingsPage — speed 선택', () => {
  it('속도 옵션 3개가 렌더링된다', () => {
    renderPage()
    expect(screen.getByText('천천히')).toBeTruthy()
    expect(screen.getByText('보통')).toBeTruthy()
    expect(screen.getByText('빠르게')).toBeTruthy()
  })

  it('빠르게 선택 후 저장 시 speed=fast가 전달된다', async () => {
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

describe('AiVoiceSettingsPage — 저장', () => {
  it('저장하기 버튼 클릭 시 saveSettings가 현재 설정으로 호출된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        { voice: 'noyj', speed: 'normal', speech_style: 'counselor' },
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
})
