import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'

const PRESETS = ['엄마', '할머니', '어머니', '외할머니', '직접 입력']

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.email ?? '사용자'
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null

  const [nickname, setNickname] = useState('엄마')
  const [selected, setSelected] = useState('엄마')
  const [customInput, setCustomInput] = useState(false)
  const [commentNotif, setCommentNotif] = useState(true)

  function handlePreset(preset: string) {
    if (preset === '직접 입력') {
      setCustomInput(true)
      setSelected('직접 입력')
    } else {
      setCustomInput(false)
      setSelected(preset)
      setNickname(preset)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">프로필 편집</h1>
        <button
          type="button"
          className="ml-auto bg-[#E8820C] rounded-lg px-4 py-1.5 min-h-11"
        >
          <span className="text-[1.0625rem] text-white">저장</span>
        </button>
      </header>

      {/* 프로필 사진 */}
      <div className="bg-white border-b border-[#E5E7EB] flex flex-col items-center py-8 gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#FEE500] flex items-center justify-center overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <span className="text-2xl text-[#3C1E1E]">{displayName.charAt(0)}</span>
            }
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FEE500] border-[3px] border-white flex items-center justify-center">
            <span className="text-[10px] text-[#3C1E1E] font-bold">K</span>
          </div>
        </div>
        <p className="text-base text-[#6B7280]">카카오 프로필 사진이 자동으로 사용돼요</p>
      </div>

      <main className="flex-1 overflow-y-auto flex flex-col gap-6 px-4 sm:px-6 py-6 w-full max-w-2xl mx-auto pb-48">

        {/* 이름 필드 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">이름</label>
          <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="flex-1 text-[1.25rem] text-[#9CA3AF]">{displayName}</span>
            <span className="bg-[#E5E7EB] rounded-lg px-3 py-1 text-sm text-[#6B7280] shrink-0">카카오에서 가져와요</span>
          </div>
          <p className="text-sm text-[#9CA3AF] px-1">이름은 카카오 앱에서 변경할 수 있어요</p>
        </div>

        {/* 호칭 필드 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">호칭</label>

          {/* 호칭 입력 */}
          <div className="bg-white border-2 border-[#E8820C] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#E8820C] shrink-0" />
            {customInput ? (
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="호칭 입력"
                className="flex-1 text-[1.375rem] text-[#1F2937] bg-transparent outline-none placeholder:text-[#D1D5DB]"
                autoFocus
              />
            ) : (
              <span className="flex-1 text-[1.375rem] text-[#1F2937]">{nickname}</span>
            )}
            <button
              type="button"
              onClick={() => { setNickname(''); setCustomInput(true); setSelected('직접 입력') }}
              className="w-8 h-8 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0"
            >
              <span className="text-base text-[#6B7280]">✕</span>
            </button>
          </div>

          {/* 미리보기 배너 */}
          <div className="bg-[#FFF0DC] rounded-xl py-3 text-center">
            <p className="text-[1.0625rem] text-[#E8820C]">
              가족 책장에 &ldquo;{nickname || '호칭'}의 책장&rdquo; 으로 표시돼요
            </p>
          </div>

          {/* 자주 쓰는 호칭 */}
          <p className="text-base text-[#6B7280] px-1 mt-1">자주 쓰는 호칭</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                className={cn(
                  'rounded-xl px-4 py-2 text-[1.125rem] border transition-colors',
                  selected === preset
                    ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                    : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* 알림 필드 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">알림</label>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-[1.125rem] text-[#1F2937]">가족 댓글 알림</p>
              <p className="text-base text-[#6B7280]">가족이 댓글을 달면 알려줘요</p>
            </div>
            <Toggle on={commentNotif} onChange={setCommentNotif} />
          </div>
        </div>

        {/* 계정 탈퇴 */}
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl py-4 text-center">
          <button type="button">
            <span className="text-[1.125rem] text-[#DC2626]">계정 탈퇴</span>
          </button>
        </div>

      </main>

      {/* 하단 저장 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 pt-3 pb-8">
        <p className="text-base text-[#6B7280] text-center mb-3">변경 사항은 저장 버튼을 눌러야 적용돼요</p>
        <button
          type="button"
          className="w-full max-w-2xl mx-auto block bg-[#E8820C] rounded-2xl py-4 text-center"
        >
          <span className="text-[1.375rem] text-white">저장하기</span>
        </button>
      </div>

    </div>
  )
}
