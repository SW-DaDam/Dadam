import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/shared/stores/authStore'
import { completeSeniorOnboarding } from '../services/authService'
import { getDbErrorMessage } from '@/lib/errorMessages'

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
    title: '가족과 함께 읽어요',
    desc: '자녀·손주가 댓글로 함께해요',
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
    <div className="relative flex items-center justify-center w-[140px] h-[140px] rounded-full bg-[#FFF0DC]">
      <div className="absolute top-2 right-3 w-5 h-5 rounded-full bg-[#FFF0DC] border-2 border-[#E8820C]" />
      <div className="absolute bottom-3 left-2 w-3.5 h-3.5 rounded-full bg-[#E8820C] opacity-40" />
      <div className="absolute bottom-6 right-2 w-3 h-3 rounded-full bg-[#E8820C] opacity-25" />
      <div className="absolute top-4 left-3 w-[18px] h-[18px] rounded-full bg-[#FFF0DC] border-[1.5px] border-[#E8820C]" />
      <div className="w-24 h-24 rounded-full bg-[#E8820C] flex items-center justify-center">
        <span className="text-[1.625rem] text-white leading-none font-bold">AI</span>
      </div>
    </div>
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
    <div className="flex-1 flex flex-col min-h-0">
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 py-6 gap-5 w-full max-w-2xl mx-auto overflow-y-auto">

        {/* 도트 인디케이터 */}
        <div className="flex items-center gap-2 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={
                i === 2
                  ? 'w-5 h-2.5 rounded-full bg-[#E8820C]'
                  : 'w-2.5 h-2.5 rounded-full bg-[#D1D5DB]'
              }
            />
          ))}
        </div>

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
