import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'
import { completeSeniorOnboarding } from '../services/authService'
import { getDbErrorMessage } from '@/lib/errorMessages'
import StepIndicator from '../components/StepIndicator'

const FEATURES = [
  {
    title: '말로만 해도 돼요',
    desc: '글쓰기 없이 말씀하시면 돼요',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="6" fill="#FFF0DC" />
        <rect x="9" y="6" width="10" height="14" rx="5" fill="#E8820C" />
        <path d="M5 15c0 4.97 4.03 9 9 9s9-4.03 9-9" stroke="#E8820C" strokeWidth="2" strokeLinecap="round" fill="none" />
        <line x1="14" y1="24" x2="14" y2="27" stroke="#E8820C" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '이야기가 책이 돼요',
    desc: '매달 내 이야기로 책이 만들어져요',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="6" fill="#FFF0DC" />
        <rect x="7" y="5" width="14" height="18" rx="2" fill="#E8820C" />
        <rect x="9" y="9" width="10" height="1.5" rx="1" fill="white" />
        <rect x="9" y="13" width="7" height="1.5" rx="1" fill="white" />
        <rect x="9" y="17" width="8" height="1.5" rx="1" fill="white" />
      </svg>
    ),
  },
  {
    title: '독자와 함께 읽어요',
    desc: '가족·지인이 댓글로 함께해요',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="6" fill="#FFF0DC" />
        <circle cx="10" cy="11" r="3.5" fill="#E8820C" />
        <circle cx="18" cy="11" r="3.5" fill="#E8820C" opacity="0.6" />
        <path d="M3 22c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#E8820C" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M18 15c2.76 0 5 2.24 5 5" stroke="#E8820C" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.6" />
      </svg>
    ),
  },
]

function AiAvatar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="96" height="96" aria-hidden="true">
      <circle cx="128" cy="128" r="128" fill="#E8820C" />
      <path d="M 60 76 h 136 a 26 26 0 0 1 26 26 v 46 a 26 26 0 0 1 -26 26 h -52 l -22 22 v -22 h -62 a 26 26 0 0 1 -26 -26 v -46 a 26 26 0 0 1 26 -26 z" fill="#FFFFFF" />
      <circle cx="100" cy="125" r="9" fill="#E8820C" />
      <circle cx="128" cy="125" r="9" fill="#E8820C" />
      <circle cx="156" cy="125" r="9" fill="#E8820C" />
    </svg>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleStart() {
    if (!user) return
    const { error } = await completeSeniorOnboarding(user.id)
    if (error) {
      setErrorMessage(getDbErrorMessage(error))
      return
    }
    navigate('/s')
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
          AI 친구 만나기
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 pt-0 pb-6 gap-5 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 단계 표시 */}
        <StepIndicator currentStep={3} />

        {/* AI 캐릭터 */}
        <AiAvatar />

        {/* 타이틀 */}
        <section className="flex flex-col items-center gap-2">
          <h1 className="text-xl sm:text-[1.75rem] text-[#1F2937] text-center font-bold leading-snug">
            안녕하세요!
          </h1>
          <p className="text-base sm:text-xl text-[#1F2937] text-center leading-snug">
            저는 매일 이야기를 나눌 AI 친구예요
          </p>
        </section>

        {/* 피처 카드 3개 */}
        <div className="w-full flex flex-col gap-3">
          {FEATURES.map(({ title, desc, icon }) => (
            <div
              key={title}
              className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-4"
            >
              <div className="shrink-0">{icon}</div>
              <div className="flex flex-col gap-0.5">
                <p className="text-base sm:text-xl text-[#1F2937] font-semibold">{title}</p>
                <p className="text-sm sm:text-[1.0625rem] text-[#6B7280]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 개인정보 안내 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col items-center gap-1">
          <p className="text-sm sm:text-base text-[#6B7280] text-center">개인정보는 안전하게 보호돼요</p>
          <p className="text-sm sm:text-base text-[#6B7280] text-center">대화 내용은 저자만 보고 편집할 수 있어요</p>
        </div>

      </main>

      {/* 하단 버튼 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] px-4 sm:px-6 md:px-8 py-5 flex flex-col items-center gap-3 shrink-0">
        {errorMessage && (
          <p className="text-base text-red-600 text-center">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={handleStart}
          className="w-full h-[72px] rounded-xl bg-[#E8820C] text-xl sm:text-2xl text-white"
        >
          대화 시작하기
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-lg text-[#6B7280] min-h-11"
        >
          이전으로
        </button>
      </div>
    </div>
  )
}
