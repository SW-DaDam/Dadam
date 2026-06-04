import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { setupFamilyProfile, acceptInviteCode } from '../services/authService'
import { getDbErrorMessage } from '@/lib/errorMessages'
import StepIndicator from '../components/StepIndicator'

const SENIOR_TITLE_MAP: Record<string, string[]> = {
  '아빠':     ['아들', '딸'],
  '아버지':   ['아들', '딸'],
  '엄마':     ['아들', '딸'],
  '어머니':   ['아들', '딸'],
  '할아버지': ['손자', '손녀'],
  '할머니':   ['손자', '손녀'],
  '장인어른': ['사위'],
  '장모님':   ['사위'],
  '시아버님': ['며느리'],
  '시어머님': ['며느리'],
}
const SENIOR_TITLE_PRESETS = Object.keys(SENIOR_TITLE_MAP)
const CODE_LENGTH = 6

export default function ReaderSetupPage() {
  const navigate = useNavigate()
  const kakaoProfile = useAuthStore((s) => s.kakaoProfile)
  const user = useAuthStore((s) => s.user)
  const [seniorTitle, setSeniorTitle] = useState('')
  const [readerNickname, setReaderNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'linked' | 'error'>('idle')
  const [inviteMessage, setInviteMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const readerSuggestions = SENIOR_TITLE_MAP[seniorTitle] ?? []

  function handleSeniorTitle(title: string) {
    setSeniorTitle(title)
    const suggestions = SENIOR_TITLE_MAP[title]
    if (suggestions?.length === 1) setReaderNickname(suggestions[0])
    else setReaderNickname('')
  }

  async function handleApplyCode(code: string) {
    if (!user || !code.trim()) return
    const st = seniorTitle.trim() || '저자'
    const rn = readerNickname.trim() || '가족'
    const result = await acceptInviteCode(code.trim(), user.id, st, rn)
    if (result.ok) {
      setInviteStatus('linked')
      setInviteMessage(result.message)
    } else {
      setInviteStatus('error')
      setInviteMessage(result.message)
    }
  }

  async function handleConfirm() {
    if (!user) return
    setSubmitting(true)
    setErrorMessage(null)

    const displayName = kakaoProfile?.name ?? '사용자'
    const { error } = await setupFamilyProfile(user.id, displayName)
    if (error) {
      setErrorMessage(getDbErrorMessage(error))
      setSubmitting(false)
      return
    }

    const pending = sessionStorage.getItem('pendingInviteCode')
    if (pending && inviteStatus !== 'linked') {
      const st = seniorTitle.trim() || '저자'
      const rn = readerNickname.trim() || '가족'
      await acceptInviteCode(pending, user.id, st, rn)
      sessionStorage.removeItem('pendingInviteCode')
    }

    navigate('/r')
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
          독자 프로필 만들기
        </h1>
      </header>

      {/* 단계 표시 */}
      <StepIndicator currentStep={2} />

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 pt-0 pb-6 md:pb-8 gap-5 md:gap-6 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 안내 텍스트 */}
        <section className="flex flex-col items-center gap-2">
          <h2 className="text-lg sm:text-2xl text-[#1F2937] text-center leading-snug">딱 두 가지만 알려주세요</h2>
          <p className="text-lg text-[#6B7280] text-center leading-[22px]">가족의 책장과 연결해 드릴게요</p>
        </section>

        {/* 카카오 자동완성 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <div className="w-[76px] h-[76px] rounded-full bg-[#FEE500] overflow-hidden flex items-center justify-center">
                {kakaoProfile?.avatarUrl ? (
                  <img src={kakaoProfile.avatarUrl} alt="카카오 프로필" className="w-full h-full object-cover" />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 40 36" fill="#3C1E1E99" aria-hidden="true">
                    <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
                  </svg>
                )}
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

        {/* STEP 1 — 호칭 설정 */}
        <div className="w-full bg-white border-2 border-[#E8820C] rounded-2xl px-6 py-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-xl text-[#1F2937]">호칭 정하기</p>
              <p className="text-[1.0625rem] text-[#6B7280]">서로 어떻게 부를지 정해요</p>
            </div>
            <div className="bg-[#E8820C] rounded px-3 py-1">
              <span className="text-[0.9375rem] text-white">입력 필요</span>
            </div>
          </div>

          {/* 저자를 부르는 호칭 */}
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280]">저자를 어떻게 부르나요?</p>
            <div className="flex gap-2 flex-wrap">
              {SENIOR_TITLE_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSeniorTitle(t)}
                  className={cn(
                    'h-12 px-5 rounded-xl text-lg border transition-all',
                    seniorTitle === t
                      ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                      : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={SENIOR_TITLE_PRESETS.includes(seniorTitle) ? '' : seniorTitle}
              onChange={(e) => handleSeniorTitle(e.target.value)}
              placeholder="직접 입력"
              className="w-full h-12 bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 text-lg text-[#1F2937] outline-none focus:border-[#E8820C] placeholder:text-[#9CA3AF]"
            />
          </div>

          {/* 저자가 나를 부르는 호칭 */}
          {seniorTitle !== '' && (
            <div className="flex flex-col gap-2">
              <p className="text-base text-[#6B7280]">저자가 나를 어떻게 부르나요?</p>
              <div className="flex gap-2 flex-wrap">
                {readerSuggestions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReaderNickname(n)}
                    className={cn(
                      'h-12 px-5 rounded-xl text-lg border transition-all',
                      readerNickname === n
                        ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                        : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={readerSuggestions.includes(readerNickname) ? '' : readerNickname}
                onChange={(e) => setReaderNickname(e.target.value)}
                placeholder="직접 입력"
                className="w-full h-12 bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 text-lg text-[#1F2937] outline-none focus:border-[#E8820C] placeholder:text-[#9CA3AF]"
              />
            </div>
          )}

          {/* 확인 요약 */}
          {seniorTitle && readerNickname && (
            <div className="bg-[#FFF0DC] rounded-lg px-4 py-2">
              <span className="text-base text-[#E8820C]">
                나는 "{seniorTitle}", 저자는 나를 "{readerNickname}"(으)로 불러요
              </span>
            </div>
          )}
        </div>

        {/* 책장 연결 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-xl text-[#1F2937]">책장 연결하기</p>
            <p className="text-[1.0625rem] text-[#6B7280]">초대 링크를 받아주세요</p>
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
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setInviteStatus('idle') }}
                placeholder="초대 코드 입력"
                maxLength={CODE_LENGTH}
                className={cn(
                  'flex-1 h-12 bg-[#F3F4F6] border rounded-lg px-4 text-xl text-[#1F2937] outline-none transition-colors tracking-widest',
                  inviteStatus === 'linked' ? 'border-[#16A34A] bg-[#F0FDF4]' :
                  inviteStatus === 'error' ? 'border-[#DC2626] bg-[#FEF2F2]' :
                  'border-[#E5E7EB] focus:border-[#E8820C] focus:bg-white',
                )}
              />
              <button
                type="button"
                onClick={() => handleApplyCode(inviteCode)}
                disabled={inviteCode.length < CODE_LENGTH || inviteStatus === 'linked'}
                className="w-16 shrink-0 h-12 bg-[#E8820C] rounded-lg text-base text-white disabled:opacity-40"
              >
                확인
              </button>
            </div>
            {inviteStatus !== 'idle' && (
              <p className={cn(
                'text-base',
                inviteStatus === 'linked' ? 'text-[#16A34A]' : 'text-[#DC2626]',
              )}>
                {inviteMessage}
              </p>
            )}
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
        {errorMessage && (
          <p className="text-base text-red-600 text-center">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={cn(
            'w-full h-[72px] rounded-xl text-[1.375rem] text-white transition-opacity',
            submitting ? 'bg-[#E8820C] opacity-40 cursor-not-allowed' : 'bg-[#E8820C]',
          )}
        >
          {submitting ? '저장 중…' : '독자로 시작하기'}
        </button>
      </div>

    </div>
  )
}
