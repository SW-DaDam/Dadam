import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { setupSeniorProfile } from '../services/authService'
import { getDbErrorMessage } from '@/lib/errorMessages'

const QUICK_NICKNAMES = ['엄마', '할머니', '어머니', '외할머니']

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const kakaoProfile = useAuthStore((s) => s.kakaoProfile)
  const user = useAuthStore((s) => s.user)
  const [nickname, setNickname] = useState('엄마')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleQuickSelect(name: string) {
    setNickname(name)
  }

  async function handleConfirm() {
    if (!user || !nickname.trim()) return
    setSubmitting(true)
    setErrorMessage(null)

    const { error } = await setupSeniorProfile(user.id, nickname.trim())
    if (error) {
      setErrorMessage(getDbErrorMessage(error))
      setSubmitting(false)
      return
    }

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

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 py-6 md:py-8 gap-5 md:gap-6 w-full max-w-2xl mx-auto">

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
          <div className="flex items-center gap-4">
            {/* 카카오 아바타 */}
            <div className="relative shrink-0">
              <div className="w-[76px] h-[76px] rounded-full bg-[#FEE500] overflow-hidden flex items-center justify-center">
                {kakaoProfile?.avatarUrl ? (
                  <img src={kakaoProfile.avatarUrl} alt="카카오 프로필" className="w-full h-full object-cover" />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 40 36" fill="#3C1E1E99" aria-hidden="true">
                    <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
                  </svg>
                )}
              </div>
              <div className="absolute -top-2 -right-2 bg-[#FEE500] rounded px-2 py-0.5">
                <span className="text-sm text-[#3C1E1E]">카카오 자동 완성</span>
              </div>
            </div>
            {/* 프로필 정보 배지 */}
            <div className="flex flex-col gap-2">
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
          </div>
        </div>

        {/* 호칭 입력 카드 */}
        <div className="w-full bg-white border-2 border-[#E8820C] rounded-2xl px-6 py-5 flex flex-col gap-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-xl text-[#1F2937]">가족이 부르는 호칭</p>
              <p className="text-[1.0625rem] text-[#6B7280]">책장 이름으로 표시돼요</p>
            </div>
            <div className="bg-[#E8820C] rounded px-3 py-1">
              <span className="text-[0.9375rem] text-white">입력 필요</span>
            </div>
          </div>

          {/* 예시 */}
          <div className="bg-[#FFF0DC] rounded-lg px-4 py-2">
            <span className="text-base text-[#E8820C]">예: "엄마의 책장" "할머니의 책장"</span>
          </div>

          {/* 입력 필드 */}
          <div className="relative">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full h-[72px] bg-[#FFF8F0] border-2 border-[#E8820C] rounded-xl px-5 text-[1.375rem] text-[#1F2937] outline-none"
            />
          </div>

          {/* 자주 쓰는 호칭 */}
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280]">자주 쓰는 호칭</p>
            <div className="flex gap-2 flex-wrap">
              {QUICK_NICKNAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleQuickSelect(name)}
                  className={cn(
                    'h-12 px-5 rounded-xl text-lg border transition-all',
                    nickname === name
                      ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                      : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 미리보기 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5 flex flex-col gap-4">
          <p className="text-lg text-[#1F2937]">가족에게 이렇게 보여요</p>
          <div className="bg-[#F5E6D0] rounded-xl p-4 flex flex-col items-center gap-2">
            <div className="flex gap-2">
              <div className="w-[52px] h-[68px] bg-[#FFF0DC] border border-[#E8820C] rounded flex items-center justify-center">
                <span className="text-xs text-[#E8820C]">4월</span>
              </div>
              <div className="w-[52px] h-[60px] bg-[#DCFCE7] border border-[#16A34A] rounded flex items-center justify-center self-end">
                <span className="text-xs text-[#16A34A]">3월</span>
              </div>
            </div>
            <p className="text-[1.375rem] text-[#1F2937]">{nickname || '엄마'}의 책장</p>
            <p className="text-base text-[#6B7280]">{kakaoProfile?.name ?? ''} 지음</p>
          </div>
        </div>

      </main>

      {/* 하단 버튼 영역 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] px-4 sm:px-6 md:px-8 py-5 flex flex-col items-center gap-3">
        <p className="text-base text-[#6B7280]">호칭은 설정에서 언제든 바꿀 수 있어요</p>
        {errorMessage && (
          <p className="text-base text-red-600 text-center">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!nickname.trim() || submitting}
          className={cn(
            'w-full h-[72px] rounded-xl text-[1.375rem] text-white transition-opacity',
            nickname.trim() && !submitting ? 'bg-[#E8820C]' : 'bg-[#E8820C] opacity-40 cursor-not-allowed',
          )}
        >
          {submitting ? '저장 중…' : '저자로 시작하기'}
        </button>
      </div>

    </div>
  )
}
