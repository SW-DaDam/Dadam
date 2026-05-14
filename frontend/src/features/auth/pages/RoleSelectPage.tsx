import { useState } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import StepIndicator from '../components/StepIndicator'

type Role = 'senior' | 'family'

function AuthorAvatar() {
  return (
    <div className="relative flex items-center justify-center w-[96px] h-[96px] rounded-full bg-[#FFF0DC] shrink-0">
      <div className="w-[68px] h-[68px] rounded-full bg-[#E8820C] flex items-center justify-center">
        <span className="text-[1.375rem] text-white leading-none">AI</span>
      </div>
    </div>
  )
}

function ReaderAvatar() {
  return (
    <div className="relative flex items-center justify-center w-[96px] h-[96px] rounded-full bg-[#F3F4F6] shrink-0">
      <div className="w-[68px] h-[68px] rounded-full bg-[#9CA3AF] flex items-center justify-center">
        {/* 사람 실루엣 */}
        <svg width="36" height="36" viewBox="0 0 48 48" fill="white" aria-hidden="true">
          <circle cx="24" cy="16" r="10" />
          <path d="M4 44c0-11.046 8.954-20 20-20s20 8.954 20 20" />
        </svg>
      </div>
    </div>
  )
}

export default function RoleSelectPage() {
  const [selected, setSelected] = useState<Role | null>(null)
  const navigate = useNavigate()
  const setRole = useAuthStore((s) => s.setRole)
  const user = useAuthStore((s) => s.user)

  const displayName: string = user?.user_metadata?.full_name ?? user?.email ?? '사용자'
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null
  const avatarChar = displayName.charAt(0)

  function handleSelect(role: Role) {
    setSelected(role)
  }

  function handleConfirm() {
    if (!selected) return
    setRole(selected)
    if (selected === 'senior') navigate('/profile-setup')
    else navigate('/reader-setup')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* 헤더 */}
      <header className="w-full h-[60px] shrink-0 bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 md:px-8 gap-4">
        <div className="w-11 h-11 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0 overflow-hidden">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            : <span className="text-sm text-[#3C1E1E]">{avatarChar}</span>
          }
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-base text-[#6B7280] leading-[19px]">카카오 로그인 완료</p>
          <p className="text-lg text-[#1F2937] leading-[22px]">{displayName} 님, 반갑습니다</p>
        </div>
      </header>

      {/* 단계 표시 */}
      <StepIndicator currentStep={1} />

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-0 pb-3 sm:pb-5 gap-3 sm:gap-4 w-full max-w-2xl mx-auto overflow-hidden">

        {/* 안내 텍스트 */}
        <section className="flex flex-col items-center shrink-0">
          <h1 className="text-lg sm:text-[1.75rem] text-[#1F2937] text-center leading-snug">
            어떻게 사용하실 건가요?
          </h1>
        </section>

        {/* 저자 카드 */}
        <button
          type="button"
          onClick={() => handleSelect('senior')}
          className={cn(
            'w-full flex-1 bg-white rounded-2xl p-8 flex flex-col items-center justify-center gap-5 text-left transition-all min-h-0',
            selected === 'senior'
              ? 'border-[3px] border-[#E8820C]'
              : 'border border-[#E5E7EB]',
          )}
        >
          <AuthorAvatar />
          <div className="flex flex-col items-center gap-1">
            <p className="text-2xl text-[#1F2937] leading-snug">저자로 시작하기</p>
            <p className="text-lg text-[#E8820C] leading-[22px]">AI 말동무와 대화하기</p>
          </div>
          <ul className="flex flex-col gap-2 w-full">
            {[
              '매일 AI와 대화하고 이야기 남기기',
              '매달 내 이야기로 책 만들기',
              '가족에게 내 책 선물하기',
            ].map((text) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E8820C] shrink-0" />
                <span className="text-[1.0625rem] text-[#6B7280] leading-[21px]">{text}</span>
              </li>
            ))}
          </ul>
        </button>

        {/* 독자 카드 */}
        <button
          type="button"
          onClick={() => handleSelect('family')}
          className={cn(
            'w-full flex-1 bg-white rounded-2xl p-8 flex flex-col items-center justify-center gap-5 text-left transition-all min-h-0',
            selected === 'family'
              ? 'border-[3px] border-[#E8820C]'
              : 'border border-[#E5E7EB]',
          )}
        >
          <ReaderAvatar />
          <div className="flex flex-col items-center gap-1">
            <p className="text-2xl text-[#1F2937] leading-snug">독자로 시작하기</p>
            <p className="text-lg text-[#6B7280] leading-[22px]">자녀 · 손주 · 가족</p>
          </div>
          <ul className="flex flex-col gap-2 w-full">
            {[
              '가족의 책 읽기',
              '댓글·사진 남기고 함께 소통하기',
            ].map((text) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF] shrink-0" />
                <span className="text-[1.0625rem] text-[#6B7280] leading-[21px]">{text}</span>
              </li>
            ))}
          </ul>
        </button>

        {/* 확인 버튼 */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected}
          className={cn(
            'w-full h-[60px] shrink-0 rounded-xl text-xl text-white leading-snug transition-opacity',
            selected ? 'bg-[#E8820C]' : 'bg-[#E8820C] opacity-40 cursor-not-allowed',
          )}
        >
          {selected === 'senior' ? '저자로 시작하기' : selected === 'family' ? '독자로 시작하기' : '역할을 선택해주세요'}
        </button>

      </main>
    </div>
  )
}
