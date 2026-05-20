import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSeniorVoiceSettings } from '@/features/senior/hooks/useSeniorVoiceSettings'
import type { TtsVoice, TtsSpeed } from '@/types/domain'

// 속도 표시 레이블 (DB 값 → 한국어)
const SPEED_LABEL: Record<TtsSpeed, string> = {
  slow: '천천히',
  normal: '보통',
  fast: '빠르게',
}

// 6개 voice 메타데이터 (카드 표시용)
const VOICE_META: Array<{
  id: TtsVoice
  gender: '여성' | '남성'
  name: string
  desc: string
}> = [
  { id: 'shimmer', gender: '여성', name: '따뜻한 목소리', desc: '포근하고 친근해요' },
  { id: 'nova',    gender: '여성', name: '밝은 목소리',   desc: '활기차고 명랑해요' },
  { id: 'coral',   gender: '여성', name: '부드러운 목소리', desc: '온화하고 편안해요' },
  { id: 'onyx',    gender: '남성', name: '깊은 목소리',   desc: '든든하고 안정적이에요' },
  { id: 'echo',    gender: '남성', name: '낮은 목소리',   desc: '조용하고 차분해요' },
  { id: 'sage',    gender: '남성', name: '지혜로운 목소리', desc: '침착하고 신뢰감 있어요' },
]

// 개별 voice 카드 — 선택 강조 + 미리듣기 버튼 포함
function VoiceCard({
  meta,
  active,
  isPlaying,
  onSelect,
  onPreview,
}: {
  meta: typeof VOICE_META[number]
  active: boolean
  isPlaying: boolean
  onSelect: () => void
  onPreview: (e: React.MouseEvent) => void
}) {
  const isFemale = meta.gender === '여성'
  return (
    // button 안에 button이 올 수 없으므로(invalid HTML) 외부 카드는 div로 구현
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      className={cn(
        'rounded-2xl p-3 flex flex-col items-center gap-1.5 relative border transition-colors cursor-pointer',
        active
          ? 'bg-[#FFF0DC] border-[#E8820C] border-[2px]'
          : 'bg-[#F9FAFB] border-[#E5E7EB]',
      )}
    >
      {/* 선택 체크 */}
      {active && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E8820C] flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">✓</span>
        </div>
      )}

      {/* 성별 아이콘 원 */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
        style={{ backgroundColor: active ? '#E8820C' : '#D1D5DB' }}
      >
        <span>{isFemale ? '♀' : '♂'}</span>
      </div>

      <p className={cn('text-sm font-medium leading-tight text-center', active ? 'text-[#E8820C]' : 'text-[#1F2937]')}>
        {meta.name}
      </p>
      <p className="text-xs text-[#6B7280] text-center leading-tight">{meta.desc}</p>

      {/* 미리듣기 버튼 — 카드 클릭과 독립 */}
      <button
        type="button"
        onClick={onPreview}
        className={cn(
          'mt-0.5 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs min-h-[28px] transition-colors',
          isPlaying
            ? 'bg-[#E8820C] text-white'
            : active
              ? 'bg-white border border-[#E8820C] text-[#E8820C]'
              : 'bg-white border border-[#D1D5DB] text-[#6B7280]',
        )}
      >
        {isPlaying
          ? <><Square size={10} className="fill-white" /> 정지</>
          : <><Play size={10} className={active ? 'fill-[#E8820C]' : 'fill-[#6B7280]'} /> 들어보기</>
        }
      </button>
    </div>
  )
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

  // 사용자가 아직 저장하지 않은 임시 선택값 — null이면 DB 값(settings)을 그대로 표시
  const [pendingVoice, setPendingVoice] = useState<TtsVoice | null>(null)
  const [pendingSpeed, setPendingSpeed] = useState<TtsSpeed | null>(null)
  const [saved, setSaved] = useState(false)  // 저장 완료 피드백

  // DB pending이 없으면 settings에서 파생 — useEffect 동기화 불필요
  const selectedVoice = pendingVoice ?? settings.voice
  const selectedSpeed = pendingSpeed ?? settings.speed

  // 마운트 시 DB 설정 로드
  useEffect(() => {
    if (userId) void loadSettings(userId)
  }, [userId, loadSettings])

  const handleSave = async () => {
    if (!userId) return
    await saveSettings(userId, { voice: selectedVoice, speed: selectedSpeed })
    // 저장 완료 후 pending 초기화 — 다음 로드 시 DB 값이 자동 반영됨
    setPendingVoice(null)
    setPendingSpeed(null)
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
          AI 목소리 설정
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto pb-48">

        {/* 에러 배너 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 현재 선택 미리듣기 배너 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-bold">AI</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-[1.125rem] text-[#1F2937]">&ldquo;안녕하세요! 저는 AI 친구예요.&rdquo;</p>
            <p className="text-base text-[#6B7280]">
              {VOICE_META.find((v) => v.id === selectedVoice)?.name} · {SPEED_LABEL[selectedSpeed]}
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

        {/* 목소리 섹션 — 2열(모바일) / 3열(sm+) 그리드 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">목소리</p>
          {loading ? (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 flex justify-center">
              <span className="text-base text-[#9CA3AF]">불러오는 중…</span>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VOICE_META.map((meta) => {
                  const key = `${meta.id}_${selectedSpeed}`
                  return (
                    <VoiceCard
                      key={meta.id}
                      meta={meta}
                      active={selectedVoice === meta.id}
                      isPlaying={playingKey === key}
                      onSelect={() => setPendingVoice(meta.id)}
                      onPreview={(e) => {
                        e.stopPropagation()
                        if (playingKey === key) {
                          stopPreview()
                        } else {
                          // 카드 미리듣기는 해당 voice + 현재 선택 speed로 재생
                          playPreview(meta.id, selectedSpeed)
                        }
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}
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
            'w-full max-w-2xl mx-auto block rounded-2xl py-4 text-center transition-colors',
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
