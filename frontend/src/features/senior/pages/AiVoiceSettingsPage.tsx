import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSeniorVoiceSettings } from '@/features/senior/hooks/useSeniorVoiceSettings'
import type { TtsVoice, TtsSpeed, SpeechStyle } from '@/types/domain'

// Phase 1: voice 1종(ngoeun) 고정 운영.
// Phase 2에서 NCP 콘솔 청취 평가 후 6종 카드 그리드(VoiceCard 컴포넌트 + VOICE_META 배열)로 재구성 예정.
const PHASE1_VOICE: TtsVoice = 'ngoeun'
const PHASE1_VOICE_LABEL = '고은'

// 속도 표시 레이블 (DB 값 → 한국어)
const SPEED_LABEL: Record<TtsSpeed, string> = {
  slow: '천천히',
  normal: '보통',
  fast: '빠르게',
}

// 말투 카드 메타데이터 (이름 + 설명 + 예시 문장)
const SPEECH_STYLE_META: Record<SpeechStyle, { label: string; desc: string; example: string }> = {
  counselor: {
    label: '공손한 상담사',
    desc: '따뜻하고 공손하게 감정을 함께 나눠요',
    example: '"그러실 만해요. 많이 힘드셨겠어요."',
  },
  friend: {
    label: '친근한 친구',
    desc: '오랜 친구처럼 편하고 솔직하게 대화해요',
    example: '"아이고, 진짜? 그래서 어떻게 됐어~"',
  },
}

export default function AiVoiceSettingsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)

  const {
    settings,
    loading,
    saving,
    error,
    playingKey,
    loadSettings,
    saveSettings,
    playPreview,
    stopPreview,
  } = useSeniorVoiceSettings()

  // 사용자가 아직 저장하지 않은 임시 speed — null이면 DB 값(settings)을 그대로 표시
  // Phase 1은 voice 변경 UI가 없으므로 voice pending 상태 불필요
  const [pendingSpeed, setPendingSpeed] = useState<TtsSpeed | null>(null)
  const [saved, setSaved] = useState(false)  // 저장 완료 피드백
  const [pendingSpeechStyle, setPendingSpeechStyle] = useState<SpeechStyle | null>(null)

  // Phase 1: voice는 항상 ngoeun 고정. speed와 speech_style만 사용자 선택 가능
  const selectedVoice = PHASE1_VOICE
  const selectedSpeed = pendingSpeed ?? settings.speed
  const selectedSpeechStyle = pendingSpeechStyle ?? settings.speech_style

  // 마운트 시 DB 설정 로드
  useEffect(() => {
    if (userId) void loadSettings(userId)
  }, [userId, loadSettings])

  const handleSave = async () => {
    if (!userId) return
    await saveSettings(userId, { voice: selectedVoice, speed: selectedSpeed, speech_style: selectedSpeechStyle })
    // 저장 완료 후 pending 초기화 — 다음 로드 시 DB 값이 자동 반영됨
    setPendingSpeed(null)
    setPendingSpeechStyle(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 현재 선택 조합의 미리듣기 재생/정지 토글
  const handleBannerPreview = () => {
    const key = `${selectedVoice}_${selectedSpeed}`
    if (playingKey === key) {
      stopPreview()
    } else {
      playPreview(selectedVoice, selectedSpeed)
    }
  }

  const bannerPlaying = playingKey === `${selectedVoice}_${selectedSpeed}`

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">
          AI 설정
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto pb-48">

        {/* 에러 배너 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 말투 선택 카드 섹션 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">말투</p>
          <div className="flex flex-col gap-3">
            {(Object.entries(SPEECH_STYLE_META) as [SpeechStyle, typeof SPEECH_STYLE_META[SpeechStyle]][]).map(([style, meta]) => (
              <button
                key={style}
                type="button"
                onClick={() => setPendingSpeechStyle(style)}
                className={cn(
                  'w-full text-left bg-white border-2 rounded-2xl px-5 py-4 transition-colors',
                  selectedSpeechStyle === style
                    ? 'border-[#E8820C] bg-[#FFFAF5]'
                    : 'border-[#E5E7EB]',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className={cn(
                    'text-[1.125rem] font-medium',
                    selectedSpeechStyle === style ? 'text-[#E8820C]' : 'text-[#1F2937]',
                  )}>
                    {meta.label}
                  </p>
                  {selectedSpeechStyle === style && (
                    <div className="w-5 h-5 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-white font-bold">✓</span>
                    </div>
                  )}
                </div>
                <p className="text-base text-[#6B7280] mb-1">{meta.desc}</p>
                <p className="text-base text-[#9CA3AF] italic">{meta.example}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 현재 선택 미리듣기 배너 — voice는 Phase 1 고정 라벨 표시 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-bold">AI</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-[1.125rem] text-[#1F2937]">&ldquo;안녕하세요! 저는 AI 친구예요.&rdquo;</p>
            <p className="text-base text-[#6B7280]">
              {PHASE1_VOICE_LABEL} · {SPEED_LABEL[selectedSpeed]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleBannerPreview}
            disabled={loading}
            className="bg-[#E8820C] rounded-xl px-3 py-2 flex items-center gap-1.5 shrink-0 min-h-11 disabled:opacity-50"
          >
            {bannerPlaying
              ? <><Square size={13} className="text-white fill-white" /><span className="text-base text-white">정지</span></>
              : <><Play size={13} className="text-white fill-white" /><span className="text-base text-white">들어보기</span></>
            }
          </button>
        </div>

        {/* 목소리 섹션 — Phase 1: 안내 박스로 임시 대체. Phase 2에서 6종 카드 그리드로 복구 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">목소리</p>
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-5 py-6 text-center">
            <p className="text-base text-[#6B7280]">
              AI 목소리는 곧 여러 종류 중에서 골라드릴 수 있게 돼요
            </p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              현재는 &lsquo;{PHASE1_VOICE_LABEL}&rsquo; 목소리로 이야기 나눠요
            </p>
          </div>
        </div>

        {/* 말하는 속도 섹션 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">말하는 속도</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex gap-3">
              {(Object.entries(SPEED_LABEL) as [TtsSpeed, string][]).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPendingSpeed(val)}
                  className={cn(
                    'flex-1 py-3 rounded-xl relative border transition-colors text-[1.125rem]',
                    selectedSpeed === val
                      ? 'bg-[#FFF0DC] border-[#E8820C] border-[2px] text-[#E8820C]'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]',
                  )}
                >
                  {selectedSpeed === val && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#E8820C] flex items-center justify-center">
                      <span className="text-[9px] text-white font-bold">✓</span>
                    </div>
                  )}
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-[#6B7280] text-center">귀에 편한 속도로 설정해 두면 편해요</p>
          </div>
        </div>

        {/* 음량 안내 — 기기 볼륨으로 조절 */}
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-5 py-4">
          <p className="text-base text-[#6B7280] text-center">
            음량은 스마트폰 옆 버튼(볼륨 키)으로 조절해 주세요
          </p>
        </div>

      </main>

      {/* 하단 저장 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 pt-3 pb-8">
        <p className="text-base text-[#6B7280] text-center mb-3">
          {saved ? '✓ 저장되었어요!' : '설정은 다음 대화부터 바로 적용돼요'}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className={cn(
            'w-full max-w-2xl md:max-w-none mx-auto block rounded-2xl py-4 text-center transition-colors',
            saving || loading
              ? 'bg-[#D1D5DB]'
              : saved
                ? 'bg-[#22C55E]'
                : 'bg-[#E8820C]',
          )}
        >
          <span className="text-[1.375rem] text-white">
            {saving ? '저장 중…' : saved ? '저장 완료!' : '저장하기'}
          </span>
        </button>
      </div>

    </div>
  )
}
