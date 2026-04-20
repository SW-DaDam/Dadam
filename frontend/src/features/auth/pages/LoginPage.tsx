import { useState } from 'react'
import { BookOpen, MessageCircle, Bell, Users, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleKakaoLogin() {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      console.error('[auth] 카카오 로그인 실패', error)
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF8F0] flex flex-col items-center px-5 py-10 gap-6">

      {/* 로고 영역 */}
      <section className="flex flex-col items-center gap-3 pt-6">
        <div className="w-20 h-20 rounded-2xl bg-[#FFF0DC] border-2 border-[#E8820C] flex items-center justify-center">
          <BookOpen size={40} strokeWidth={1.5} className="text-[#E8820C]" />
        </div>
        <h1 className="text-[28px] font-medium text-[#1F2937] text-center leading-snug">
          내 이야기 책
        </h1>
        <p className="text-lg text-[#6B7280] text-center">
          AI 말동무와 함께 만드는 가족 출판 플랫폼
        </p>
      </section>

      {/* 웰컴 카드 */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E5E7EB] px-6 py-5 flex flex-col gap-2 text-center">
        <p className="text-[20px] font-medium text-[#1F2937]">처음 오셨나요?</p>
        <p className="text-lg text-[#6B7280]">카카오톡으로 바로 시작할 수 있어요</p>
        <p className="text-base text-[#6B7280]">별도 회원가입이 필요 없어요</p>
      </div>

      {/* 카카오 로그인 버튼 */}
      <button
        type="button"
        onClick={handleKakaoLogin}
        disabled={isLoading}
        className={cn(
          'w-full max-w-sm min-h-14 rounded-xl bg-[#FEE500] text-[#3C1E1E]',
          'flex items-center justify-center gap-3',
          'text-[20px] font-medium',
          'transition-opacity',
          isLoading && 'opacity-60 cursor-not-allowed',
        )}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#3C1E1E" aria-hidden="true">
          <path d="M12 3C6.477 3 2 6.582 2 11c0 2.75 1.636 5.177 4.123 6.66L5.1 21.5a.5.5 0 0 0 .725.534L10.1 19.8A11.8 11.8 0 0 0 12 20c5.523 0 10-3.582 10-8s-4.477-9-10-9Z" />
        </svg>
        {isLoading ? '로그인 중…' : '카카오톡으로 시작하기'}
      </button>

      {/* 안내 카드 */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E5E7EB] px-6 py-5 flex flex-col gap-4">
        <p className="text-lg font-medium text-[#1F2937]">카카오톡 연동으로 할 수 있어요</p>
        <ul className="flex flex-col gap-3">
          {[
            { icon: Users,         text: '가족을 카카오 링크로 손쉽게 초대' },
            { icon: Bell,          text: '새 댓글·답장 알림을 카카오로 받기' },
            { icon: Shield,        text: '별도 비밀번호 없이 안전하게 로그인' },
            { icon: MessageCircle, text: '카카오 이름·프로필 사진만 사용해요' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon size={20} className="text-[#E8820C] shrink-0" />
              <span className="text-[17px] text-[#1F2937]">{text}</span>
            </li>
          ))}
        </ul>
        <p className="text-[15px] text-[#6B7280] text-center pt-1 border-t border-[#E5E7EB]">
          카카오 이름·프로필 사진만 사용해요
        </p>
      </div>

      {/* 약관 */}
      <p className="text-[15px] text-[#6B7280] text-center px-4 pb-4">
        로그인 시{' '}
        <button type="button" className="underline underline-offset-2 min-h-0">
          개인정보 처리방침 및 이용약관
        </button>
        에 동의하게 돼요
      </p>

    </main>
  )
}
