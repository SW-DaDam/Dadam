import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'

const RELATIONS = ['아들', '딸', '손자', '손녀', '사위', '며느리', '직접 입력']
const CODE_LENGTH = 6

export default function ReaderSetupPage() {
  const navigate = useNavigate()
  const kakaoProfile = useAuthStore((s) => s.kakaoProfile)
  const [relation, setRelation] = useState('아들')
  const [customRelation, setCustomRelation] = useState('')
  const [inviteCode, setInviteCode] = useState(['A', '3', 'K', '7', '', ''])

  function handleCodeChange(index: number, value: string) {
    const next = [...inviteCode]
    next[index] = value.toUpperCase().slice(-1)
    setInviteCode(next)
  }

  function handleConfirm() {
    // TODO: F-11 완료 후 family_links 연결
    navigate('/r')
  }

  return (
    <div className="flex-1 flex flex-col">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-6 relative shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center min-h-11"
        >
          <ChevronLeft size={22} className="text-[#6B7280]" />
          
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] whitespace-nowrap font-medium">
          독자 프로필 만들기
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 py-6 md:py-8 gap-5 md:gap-6 overflow-y-auto w-full max-w-2xl mx-auto">

        {/* 안내 텍스트 */}
        <section className="flex flex-col items-center gap-2">
          <h2 className="text-lg sm:text-2xl text-[#1F2937] text-center leading-snug">딱 두 가지만 알려주세요</h2>
          <p className="text-lg text-[#6B7280] text-center leading-[22px]">가족의 책장과 연결해 드릴게요</p>
        </section>

        {/* 카카오 자동완성 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5">
          <div className="flex items-center gap-4">
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
            <div className="flex flex-col gap-2">
              {['프로필 사진', `이름 ${kakaoProfile?.name ?? '—'}`].map((label) => (
                <div key={label} className="flex items-center gap-2 bg-[#F3F4F6] rounded px-3 py-1.5">
                  <span className="text-[0.9375rem] text-[#6B7280]">{label}</span>
                  <div className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
                    <span className="text-xs text-white">✓</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 1 — 관계 선택 */}
        <div className="w-full bg-white border-2 border-[#E8820C] rounded-2xl px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-xl text-[#1F2937]">저자와의 관계</p>
              <p className="text-[1.0625rem] text-[#6B7280]">저자가 나를 어떻게 부르나요?</p>
            </div>
            <div className="bg-[#E8820C] rounded px-3 py-1">
              <span className="text-[0.9375rem] text-white">STEP 1</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelation(r)}
                className={cn(
                  'h-12 px-5 rounded-xl text-lg border transition-all',
                  relation === r
                    ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                    : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {relation === '직접 입력' && (
            <input
              type="text"
              value={customRelation}
              onChange={(e) => setCustomRelation(e.target.value)}
              placeholder="관계를 입력해주세요"
              className="w-full h-[56px] bg-[#FFF8F0] border-2 border-[#E8820C] rounded-xl px-5 text-lg text-[#1F2937] outline-none placeholder:text-[#9CA3AF]"
              autoFocus
            />
          )}
        </div>

        {/* STEP 2 — 책장 연결 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-xl text-[#1F2937]">책장 연결하기</p>
              <p className="text-[1.0625rem] text-[#6B7280]">초대 링크를 받아주세요</p>
            </div>
            <div className="bg-[#6B7280] rounded px-3 py-1">
              <span className="text-[0.9375rem] text-white">STEP 2</span>
            </div>
          </div>

          {/* 카카오 링크 옵션 */}
          <div className="bg-[#FFF0DC] rounded-xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#FEE500] rounded px-2 py-1">
                <span className="text-xs text-[#3C1E1E]">링크</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[1.0625rem] text-[#1F2937]">카카오로 받은 초대 링크</p>
                <p className="text-base text-[#6B7280]">링크를 누르면 바로 연결돼요</p>
              </div>
            </div>
            <div className="bg-[#E8820C] rounded px-3 py-1 shrink-0">
              <span className="text-sm text-white">추천</span>
            </div>
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
            <span className="text-base text-[#6B7280]">또는</span>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          {/* 코드 직접 입력 */}
          <div className="flex flex-col gap-3">
            <p className="text-[1.0625rem] text-[#6B7280]">초대 코드 직접 입력</p>
            <div className="flex gap-1.5">
              {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={inviteCode[i] ?? ''}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  className={cn(
                    'flex-1 min-w-0 aspect-square bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg',
                    'text-xl text-[#1F2937] text-center outline-none',
                    'focus:border-[#E8820C] focus:bg-white transition-colors',
                  )}
                />
              ))}
              <button
                type="button"
                className="w-14 shrink-0 aspect-square bg-[#E8820C] rounded-lg text-sm text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>

        {/* 나중에 연결 안내 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0 mt-0.5">
            <Info size={16} className="text-[#6B7280]" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base text-[#6B7280]">초대 링크가 없어도 일단 시작할 수 있어요</p>
            <p className="text-base text-[#6B7280]">나중에 받아서 연결하면 돼요</p>
          </div>
        </div>

      </main>

      {/* 하단 버튼 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] px-4 sm:px-6 md:px-8 py-5 flex flex-col items-center gap-3 shrink-0">
        <p className="text-base text-[#6B7280]">관계 · 연결은 설정에서 언제든 바꿀 수 있어요</p>
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-[72px] rounded-xl bg-[#E8820C] text-[1.375rem] text-white"
        >
          독자로 시작하기
        </button>
      </div>

    </div>
  )
}
