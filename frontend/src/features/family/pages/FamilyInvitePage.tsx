import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInvite } from '@/features/family/hooks/useInvite'

export default function FamilyInvitePage() {
  const navigate = useNavigate()
  const { inviteCode, inviteLink, generateInviteCode, loading } = useInvite()
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function handleGenerateCode() {
    setGenerating(true)
    await generateInviteCode()
    setGenerating(false)
  }

  function handleCopy() {
    const text = inviteLink ?? inviteCode ?? ''
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleKakaoShare() {
    const link = inviteLink ?? ''
    if (!link) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Kakao = (window as any).Kakao
    if (!Kakao) return
    if (!Kakao.isInitialized()) {
      Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
    }
    const imageUrl = `${window.location.origin}/og-image.png`
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '다담에서 가족 초대가 왔어요 📖',
        description: '버튼을 눌러 가족으로 연결하고 함께 이야기를 나눠요',
        imageUrl,
        link: { mobileWebUrl: link, webUrl: link },
      },
      buttons: [
        {
          title: '초대 수락하기',
          link: { mobileWebUrl: link, webUrl: link },
        },
      ],
    })
  }

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">가족 초대하기</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 안내 배너 */}
        <div className="w-full bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0 text-white text-sm font-bold">AI</div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">카카오톡으로 초대장을 보내요</p>
            <p className="text-base text-[#6B7280]">가족이 링크를 누르면 바로 연결돼요</p>
          </div>
        </div>

        {/* 카카오 빠른 초대 */}
        <button
          type="button"
          onClick={handleKakaoShare}
          disabled={!inviteLink}
          className="w-full bg-[#FEE500] disabled:opacity-50 rounded-2xl px-5 py-4 flex items-center gap-4"
        >
          <svg width="28" height="26" viewBox="0 0 40 36" fill="#3C1E1E" aria-hidden="true" className="shrink-0">
            <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
          </svg>
          <div className="flex-1 flex flex-col gap-0.5 text-left">
            <p className="text-xl text-[#3C1E1E]">카카오톡으로 초대장 보내기</p>
            <p className="text-base text-[#3C1E1E] opacity-70">버튼 한 번으로 초대 링크가 전달돼요</p>
          </div>
          <ChevronRight size={20} className="text-[#3C1E1E] opacity-40 shrink-0" />
        </button>

        {/* 링크 복사 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <Copy size={18} className="text-[#6B7280]" />
          </div>
          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
            <p className="text-[1.0625rem] text-[#1F2937]">초대 링크 복사하기</p>
            <p className="text-sm text-[#6B7280] truncate">{inviteLink ?? '코드를 먼저 생성해주세요'}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!inviteLink}
            className={cn(
              'rounded-lg px-3 py-2 shrink-0 min-h-11 text-base transition-colors disabled:opacity-40',
              copied ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F3F4F6] text-[#6B7280]',
            )}
          >
            {copied ? '복사됨' : '링크 복사'}
          </button>
        </div>

        {/* 초대 코드 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <p className="text-base text-[#6B7280]">초대 코드</p>
            {loading ? (
              <div className="h-9 w-24 bg-[#F3F4F6] rounded-lg animate-pulse" />
            ) : inviteCode ? (
              <div className="bg-[#F3F4F6] rounded-lg px-4 py-2 self-start">
                <span className="text-[1.0625rem] text-[#1F2937] tracking-widest font-mono">{inviteCode}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={generating}
                className="bg-[#E8820C] rounded-lg px-4 py-2 self-start min-h-11 disabled:opacity-60"
              >
                <span className="text-base text-white">{generating ? '생성 중…' : '코드 생성하기'}</span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5 shrink-0">
            <p className="text-sm text-[#6B7280]">코드를 알려주면 가족이</p>
            <p className="text-sm text-[#6B7280]">직접 입력해서 연결해요</p>
          </div>
        </div>

      </main>
    </div>
  )
}
