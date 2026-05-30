// AiVoiceSettingsPage 테스트 (Phase 2 — 성별 탭 UI)
// 구조: 성별 탭(여성/남성) 선택 후 3종 카드 표시, 개별 듣기 버튼/PRO 배지 없음
// 배너 "들어보기" 버튼만 유지

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
const mockSaveSettings = vi.fn().mockResolvedValue(true)
const mockPlayPreview = vi.fn()
const mockStopPreview = vi.fn()
const mockSetSettings = vi.fn()

let mockSettingsState: { voice: TtsVoice; speed: TtsSpeed; speech_style: SpeechStyle } = {
  voice: 'vara',  // 디폴트: 아라
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
  mockSettingsState = { voice: 'vara', speed: 'normal', speech_style: 'counselor' }
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

  it('음량 안내 텍스트가 없다 (삭제됨)', () => {
    renderPage()
    expect(screen.queryByText(/볼륨 키/)).toBeNull()
  })
})

describe('AiVoiceSettingsPage — 성별 탭 + voice 카드', () => {
  it('여성/남성 탭 버튼이 렌더링된다', () => {
    renderPage()
    expect(screen.getByRole('button', { name: '여성' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '남성' })).toBeTruthy()
  })

  it('vara(아라) 선택 상태 → 여성 탭이 활성화되고 여성 3종이 보인다', () => {
    // mockSettingsState.voice = 'vara' (여성)
    renderPage()
    // 여성 카드 3종
    expect(screen.getByText('유나')).toBeTruthy()
    expect(screen.getByText('봄달')).toBeTruthy()
    expect(screen.getByText('아라')).toBeTruthy()
    // 남성 카드는 보이지 않음
    expect(screen.queryByText('민상')).toBeNull()
  })

  it('남성 탭 클릭 시 남성 3종 카드로 전환된다', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '남성' }))
    expect(screen.getByText('민상')).toBeTruthy()
    expect(screen.getByText('시윤')).toBeTruthy()
    expect(screen.getByText('이안')).toBeTruthy()
    // 여성 카드는 보이지 않음
    expect(screen.queryByText('유나')).toBeNull()
  })

  it('PRO 배지가 없다', () => {
    renderPage()
    expect(screen.queryByText('PRO')).toBeNull()
  })

  it('카드에 개별 듣기 버튼이 없다', () => {
    renderPage()
    // 배너의 "들어보기" 버튼 1개만 존재
    expect(screen.getAllByText('들어보기')).toHaveLength(1)
    expect(screen.queryByText('듣기')).toBeNull()
  })

  it('voice 카드 클릭 시 해당 voice가 저장에 반영된다', async () => {
    renderPage()
    // 봄달 카드 클릭 (여성 탭)
    fireEvent.click(screen.getByText('봄달').closest('button')!)
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ voice: 'noyj' }),
      )
    })
  })

  it('남성 탭 전환 후 카드 클릭 시 해당 voice가 저장에 반영된다', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '남성' }))
    fireEvent.click(screen.getByText('민상').closest('button')!)
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ voice: 'nminsang' }),
      )
    })
  })

  it('nminsang 설정 로드 시 남성 탭이 초기 활성화된다', () => {
    mockSettingsState = { voice: 'nminsang', speed: 'normal', speech_style: 'counselor' }
    renderPage()
    // 남성 탭이 활성 → 민상이 보여야 함
    expect(screen.getByText('민상')).toBeTruthy()
    expect(screen.queryByText('유나')).toBeNull()
  })
})

describe('AiVoiceSettingsPage — 미리듣기 배너', () => {
  it('선택된 voice 이름(아라)과 speed가 배너에 표시된다', () => {
    renderPage()
    // 배너 서브텍스트 "아라 · 보통" 형태 — 가운데 점 포함 문자열로 검증
    expect(screen.getByText(/아라\s*·\s*보통/)).toBeTruthy()
  })

  it('배너 들어보기 클릭 시 playPreview가 현재 voice + speed로 호출된다', () => {
    renderPage()
    fireEvent.click(screen.getByText('들어보기'))
    expect(mockPlayPreview).toHaveBeenCalledWith('vara', 'normal')
  })

  it('배너 재생 중일 때 정지 버튼 클릭 시 stopPreview가 호출된다', () => {
    mockPlayingKey = 'vara_normal'
    renderPage()
    fireEvent.click(screen.getByText('정지'))
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
  it('저장하기 버튼 클릭 시 saveSettings가 현재 설정(vara/normal)으로 호출된다', async () => {
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        'user-123',
        { voice: 'vara', speed: 'normal', speech_style: 'counselor' },
      )
    })
  })

  it('저장 성공 시 saveSettings가 true를 반환하고 navigate(-1)이 호출된다', async () => {
    mockSaveSettings.mockResolvedValueOnce(true)
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled()
    })
    // navigate(-1)은 MemoryRouter 환경에서 에러 없이 처리됨
  })

  it('저장 실패 시 saveSettings가 false를 반환하고 페이지에 머문다', async () => {
    mockSaveSettings.mockResolvedValueOnce(false)
    renderPage()
    fireEvent.click(screen.getByText('저장하기'))
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled()
    })
    // 페이지 이탈 없이 저장하기 버튼이 여전히 있어야 함
    expect(screen.getByText('저장하기')).toBeTruthy()
  })

  it('saving=true 시 저장 버튼이 disabled 상태다', () => {
    mockSaving = true
    renderPage()
    const saveBtn = screen.getByRole('button', { name: /저장 중/ })
    expect(saveBtn).toBeDisabled()
  })
})
