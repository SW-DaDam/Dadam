import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSeniorVoiceSettings } from '@/features/senior/hooks/useSeniorVoiceSettings'
import type { TtsVoice, TtsSpeed, SpeechStyle } from '@/types/domain'

// 말하기 속도 표시 레이블
const SPEED_LABEL: Record<TtsSpeed, string> = {
  slow: '천천히',
  normal: '보통',
  fast: '빠르게',
}

// 말투 카드 메타데이터
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

// 화자 메타데이터 — 이름과 성별만 관리 (PRO 구분 표시 없음)
const VOICE_META: Record<TtsVoice, { label: string; gender: '여성' | '남성'; tags: string }> = {
  nyuna:    { label: '유나',  gender: '여성', tags: '#활기찬 #싹싹한' },
  noyj:     { label: '봄달',  gender: '여성', tags: '#자분한 #친절한' },
  vara:     { label: '아라',  gender: '여성', tags: '#활기찬 #자분한' },
  nminsang: { label: '민상',  gender: '남성', tags: '#신뢰가는 #자분한' },
  nsiyoon:  { label: '시윤',  gender: '남성', tags: '#신뢰가는 #쓸쓸한' },
  vian:     { label: '이안',  gender: '남성', tags: '#활기찬 #싹싹한' },
}

const FEMALE_VOICES: TtsVoice[] = ['nyuna', 'noyj', 'vara']
const MALE_VOICES: TtsVoice[]   = ['nminsang', 'nsiyoon', 'vian']

type GenderTab = 'female' | 'male'

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

  // 아직 저장하지 않은 임시 선택값 — null이면 DB 값(settings)을 그대로 표시
  const [pendingVoice, setPendingVoice] = useState<TtsVoice | null>(null)
  const [pendingSpeed, setPendingSpeed] = useState<TtsSpeed | null>(null)
  const [pendingSpeechStyle, setPendingSpeechStyle] = useState<SpeechStyle | null>(null)
  const selectedVoice = pendingVoice ?? settings.voice
  const selectedSpeed = pendingSpeed ?? settings.speed
  const selectedSpeechStyle = pendingSpeechStyle ?? settings.speech_style

  // 성별 탭 — 현재 선택된 목소리 성별로 초기화
  const [genderTab, setGenderTab] = useState<GenderTab>(() =>
    FEMALE_VOICES.includes(settings.voice) ? 'female' : 'male',
  )

  useEffect(() => {
    if (userId) void loadSettings(userId)
  }, [userId, loadSettings])

  // settings 로드 완료 후 탭도 맞춰줌
  useEffect(() => {
    setGenderTab(FEMALE_VOICES.includes(settings.voice) ? 'female' : 'male')
  }, [settings.voice])

  const handleSave = async () => {
    if (!userId) return
    const ok = await saveSettings(userId, {
      voice: selectedVoice,
      speed: selectedSpeed,
      speech_style: selectedSpeechStyle,
    })
    // 저장 실패 시 에러 배너가 표시되므로 현재 페이지에 머문다
    if (ok) navigate(-1)
  }

  // 배너 미리듣기 — 현재 선택된 voice + speed 조합
  const bannerKey = `${selectedVoice}_${selectedSpeed}`
  const bannerPlaying = playingKey === bannerKey

  const handleBannerPreview = () => {
    if (bannerPlaying) {
      stopPreview()
    } else {
      playPreview(selectedVoice, selectedSpeed)
    }
  }

  // 성별 탭 전환 — 전환 시 해당 성별의 첫 번째 목소리를 pending으로 설정
  // (단, 이미 해당 성별 목소리가 선택된 경우엔 유지)
  const handleGenderTab = (tab: GenderTab) => {
    setGenderTab(tab)
    const voices = tab === 'female' ? FEMALE_VOICES : MALE_VOICES
    const current = pendingVoice ?? settings.voice
    if (!voices.includes(current)) {
      setPendingVoice(voices[0])
    }
  }

  const voicesForTab = genderTab === 'female' ? FEMALE_VOICES : MALE_VOICES

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-14 bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={20} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base sm:text-lg text-[#1F2937] font-medium whitespace-nowrap">
          AI 설정
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 sm:px-6 py-3 w-full max-w-2xl mx-auto pb-28">

        {/* 에러 배너 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 말투 선택 */}
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

        {/* 목소리 + 말하는 속도 — 하나의 카드 박스로 묶음 */}
        <div className="border border-[#E5E7EB] rounded-2xl p-3 flex flex-col gap-3">

          {/* 목소리 선택 */}
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[#6B7280]">목소리</p>

            {/* 성별 탭 */}
            <div className="flex bg-[#F3F4F6] rounded-lg p-1 gap-1">
              {(['female', 'male'] as GenderTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleGenderTab(tab)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-base font-medium transition-colors',
                    genderTab === tab
                      ? 'bg-white text-[#1F2937] shadow-sm'
                      : 'text-[#9CA3AF]',
                  )}
                >
                  {tab === 'female' ? '여성' : '남성'}
                </button>
              ))}
            </div>

            {/* 선택된 성별의 3종 카드 */}
            <div className="grid grid-cols-3 gap-2">
              {voicesForTab.map((voice) => {
                const isSelected = selectedVoice === voice
                return (
                  <button
                    key={voice}
                    type="button"
                    onClick={() => setPendingVoice(voice)}
                    className={cn(
                      'flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-colors relative gap-1',
                      isSelected
                        ? 'border-[#E8820C] bg-[#FFFAF5]'
                        : 'border-[#E5E7EB] bg-[#F9FAFB]',
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#E8820C] flex items-center justify-center">
                        <span className="text-[9px] text-white font-bold">✓</span>
                      </div>
                    )}
                    <p className={cn(
                      'text-base font-medium',
                      isSelected ? 'text-[#E8820C]' : 'text-[#1F2937]',
                    )}>
                      {VOICE_META[voice].label}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] leading-tight text-center">
                      {VOICE_META[voice].tags}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-[#F3F4F6]" />

          {/* 말하는 속도 */}
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[#6B7280]">말하는 속도</p>
            <div className="flex gap-2">
              {(Object.entries(SPEED_LABEL) as [TtsSpeed, string][]).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPendingSpeed(val)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl relative border transition-colors text-base',
                    selectedSpeed === val
                      ? 'bg-[#FFF0DC] border-[#E8820C] border-[2px] text-[#E8820C]'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]',
                  )}
                >
                  {selectedSpeed === val && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#E8820C] flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">✓</span>
                    </div>
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 현재 선택 미리듣기 배너 — 속도 선택 아래 위치 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-xs text-white font-bold">AI</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-base text-[#1F2937]">&ldquo;안녕하세요! 저는 AI 친구예요.&rdquo;</p>
            <p className="text-sm text-[#6B7280]">
              {VOICE_META[selectedVoice].label} · {SPEED_LABEL[selectedSpeed]}
            </p>
          </div>
          <button
            type="button"
            onClick={handleBannerPreview}
            disabled={loading}
            className="bg-[#E8820C] rounded-xl px-3 py-2 flex items-center gap-1.5 shrink-0 min-h-11 disabled:opacity-50"
          >
            {bannerPlaying
              ? <><Square size={12} className="text-white fill-white" /><span className="text-sm text-white">정지</span></>
              : <><Play size={12} className="text-white fill-white" /><span className="text-sm text-white">들어보기</span></>
            }
          </button>
        </div>

      </main>

      {/* 하단 저장 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 pt-2 pb-5">
        <p className="text-sm text-[#6B7280] text-center mb-2">
          설정은 다음 대화부터 바로 적용돼요
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className={cn(
            'w-full max-w-2xl mx-auto block rounded-2xl py-3 text-center transition-colors',
            saving || loading ? 'bg-[#D1D5DB]' : 'bg-[#E8820C]',
          )}
        >
          <span className="text-xl text-white">
            {saving ? '저장 중…' : '저장하기'}
          </span>
        </button>
      </div>

    </div>
  )
}
