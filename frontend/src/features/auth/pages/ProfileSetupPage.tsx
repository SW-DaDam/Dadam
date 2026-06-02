import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { setupSeniorProfile } from '../services/authService'
import { getDbErrorMessage } from '@/lib/errorMessages'
import StepIndicator from '../components/StepIndicator'

const CURRENT_YEAR = new Date().getFullYear()

// userId를 키에 포함 — 동일 브라우저에서 계정 전환 시 다른 사람 데이터가 채워지지 않도록
const sessionKey = (userId: string) => `profile-setup-draft-${userId}`

function loadDraft(userId: string) {
  try {
    const raw = sessionStorage.getItem(sessionKey(userId))
    if (!raw) return { nickname: '', gender: null, birthYear: '' }
    return JSON.parse(raw) as { nickname: string; gender: 'male' | 'female' | null; birthYear: string }
  } catch {
    return { nickname: '', gender: null, birthYear: '' }
  }
}

function saveDraft(userId: string, nickname: string, gender: 'male' | 'female' | null, birthYear: string) {
  sessionStorage.setItem(sessionKey(userId), JSON.stringify({ nickname, gender, birthYear }))
}

function clearDraft(userId: string) {
  sessionStorage.removeItem(sessionKey(userId))
}

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const kakaoProfile = useAuthStore((s) => s.kakaoProfile)
  const user = useAuthStore((s) => s.user)

  const userId = user?.id ?? ''
  const draft = loadDraft(userId)
  // 호칭 UI 제거 후 카카오 이름을 기본값으로 사용 — display_name 빈 문자열 방지
  const nickname = draft.nickname || kakaoProfile?.name || ''
  const [gender, setGender] = useState<'male' | 'female' | null>(draft.gender)
  const [birthYear, setBirthYear] = useState(draft.birthYear)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [avatarLoaded, setAvatarLoaded] = useState(false)

  function handleGenderChange(g: 'male' | 'female') {
    const next = gender === g ? null : g
    setGender(next)
    saveDraft(userId, nickname, next, birthYear)
  }

  function handleBirthYearChange(val: string) {
    if (val.length <= 4) {
      setBirthYear(val)
      saveDraft(userId, nickname, gender, val)
    }
  }

  const isBirthYearInvalid = birthYear.length === 4 && (Number(birthYear) <= 1900 || Number(birthYear) >= CURRENT_YEAR)

  async function handleConfirm() {
    if (!user || isBirthYearInvalid) return
    setSubmitting(true)
    setErrorMessage(null)

    const year = Number(birthYear)
    const isValidYear = birthYear.length === 4 && year > 1900 && year < CURRENT_YEAR
    const birthDate = isValidYear ? `${birthYear}-01-01` : null
    const { error } = await setupSeniorProfile(user.id, nickname.trim(), gender, birthDate)
    if (error) {
      setErrorMessage(getDbErrorMessage(error))
      setSubmitting(false)
      return
    }

    clearDraft(userId)
    navigate('/onboarding')
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-6 relative">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center min-h-11"
        >
          <ChevronLeft size={22} className="text-[#6B7280]" />
          
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] whitespace-nowrap font-medium">
          저자 프로필 만들기
        </h1>
      </header>

      {/* 단계 표시 */}
      <StepIndicator currentStep={2} />

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 pt-0 pb-6 md:pb-8 gap-5 md:gap-6 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 안내 텍스트 */}
        <section className="flex flex-col items-center gap-2">
          <h2 className="text-lg sm:text-2xl text-[#1F2937] text-center leading-snug">
            딱 한 가지만 알려주세요
          </h2>
          <p className="text-lg text-[#6B7280] text-center leading-[22px]">
            나머지는 AI와 대화하면서 채워져요
          </p>
        </section>

        {/* 카카오 프로필 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5">
          <div className="flex items-start gap-4">
            {/* 카카오 아바타 */}
            <div className="relative shrink-0">
              <div className="w-[76px] h-[76px] rounded-full bg-[#FEE500] overflow-hidden flex items-center justify-center">
                {kakaoProfile?.avatarUrl ? (
                  <img
                    src={kakaoProfile.avatarUrl}
                    alt="카카오 프로필"
                    className="w-full h-full object-cover"
                    onLoad={() => setAvatarLoaded(true)}
                  />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 40 36" fill="#3C1E1E99" aria-hidden="true">
                    <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
                  </svg>
                )}
              </div>
              {/* 프로필 사진 로드 전에만 표시 */}
              {!avatarLoaded && (
                <div className="absolute -top-2 -right-2 bg-[#FEE500] rounded px-2 py-0.5">
                  <span className="text-sm text-[#3C1E1E]">카카오 자동 완성</span>
                </div>
              )}
            </div>

            {/* 오른쪽: 카카오 자동완성 배지 + 성별/나이 입력 */}
            <div className="flex-1 flex flex-col gap-3">
              {/* 카카오 자동완성 배지 */}
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-[#F3F4F6] rounded px-3 py-1.5">
                  <span className="text-[0.9375rem] text-[#6B7280]">프로필 사진</span>
                  <div className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center">
                    <span className="text-sm text-white">✓</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-[#F3F4F6] rounded px-3 py-1.5">
                  <span className="text-[0.9375rem] text-[#6B7280]">이름 {kakaoProfile?.name ?? '—'}</span>
                  <div className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center">
                    <span className="text-sm text-white">✓</span>
                  </div>
                </div>
              </div>

              {/* 성별 선택 */}
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-[#6B7280]">성별 <span className="text-[#9CA3AF]">(선택)</span></p>
                <div className="flex gap-2">
                  {(['female', 'male'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGenderChange(g)}
                      className={cn(
                        'h-10 px-4 rounded-lg text-base border transition-all',
                        gender === g
                          ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                          : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                      )}
                    >
                      {g === 'female' ? '여성' : '남성'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 출생연도 입력 */}
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-[#6B7280]">출생연도 <span className="text-[#9CA3AF]">(선택)</span></p>
                {birthYear.length === 4 && (Number(birthYear) <= 1900 || Number(birthYear) >= CURRENT_YEAR) && (
                  <p className="text-sm text-red-500">1901년 ~ {CURRENT_YEAR - 1}년 사이로 입력해 주세요</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={birthYear}
                    onChange={(e) => handleBirthYearChange(e.target.value)}
                    placeholder="예: 1955"
                    min={1901}
                    max={CURRENT_YEAR - 1}
                    className={cn(
                      'w-28 h-10 bg-[#F3F4F6] border rounded-lg px-3 text-base text-[#1F2937] outline-none focus:border-[#E8820C]',
                      birthYear.length === 4 && (Number(birthYear) <= 1900 || Number(birthYear) >= CURRENT_YEAR)
                        ? 'border-red-400'
                        : 'border-[#E5E7EB]',
                    )}
                  />
                  <span className="text-base text-[#6B7280]">년</span>
                </div>
              </div>
            </div>
          </div>
        </div>


      </main>

      {/* 하단 버튼 영역 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] px-4 sm:px-6 md:px-8 py-5 flex flex-col items-center gap-3">
        {errorMessage && (
          <p className="text-base text-red-600 text-center">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || isBirthYearInvalid}
          className={cn(
            'w-full h-[72px] rounded-xl text-[1.375rem] text-white transition-opacity',
            !submitting && !isBirthYearInvalid ? 'bg-[#E8820C]' : 'bg-[#E8820C] opacity-40 cursor-not-allowed',
          )}
        >
          {submitting ? '저장 중…' : '저자로 시작하기'}
        </button>
      </div>

    </div>
  )
}
