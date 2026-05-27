import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, BookOpen, Users } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/lib/supabase'
import { useThemeStore } from '@/shared/stores/themeStore'
import { useFontSizeStore, type FontSize } from '@/shared/stores/fontSizeStore'
import { useFamilyBookshelf } from '@/features/bookshelf/hooks/useFamilyBookshelf'
import { cn } from '@/lib/utils'

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: '작음' },
  { value: 'medium', label: '중간' },
  { value: 'large', label: '큼' },
]

export default function ReaderSettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '사용자'
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null
  const avatarChar = displayName.charAt(0)

  const [notifNewBook, setNotifNewBook] = useState(true)
  const [notifReply, setNotifReply] = useState(true)
  const [notifFamily, setNotifFamily] = useState(false)
  const { darkMode: darkModeOn, setDarkMode: setDarkModeOn } = useThemeStore()
  const { fontSize, setFontSize } = useFontSizeStore()
  const { seniorName, relationship } = useFamilyBookshelf()

  return (
    <div className="flex flex-col h-full">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-center px-4 sm:px-6 shrink-0">
        <h1 className="text-lg sm:text-xl text-[#1F2937] font-medium">설정</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 프로필 카드 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : <span className="text-base text-[#3C1E1E]">{avatarChar}</span>
              }
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FEE500] border-2 border-white flex items-center justify-center">
              <span className="text-[8px] text-[#3C1E1E] font-bold">K</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-[1.375rem] text-[#1F2937]">{displayName}</p>
            <p className="text-[1.0625rem] text-[#6B7280]">{relationship ? `관계: ${relationship} · 독자` : '독자'}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/r/settings/profile')}
            className="bg-[#FFF0DC] rounded-lg px-3 py-2 text-[1.0625rem] text-[#E8820C] shrink-0 min-h-11"
          >
            프로필 편집
          </button>
        </div>

        {/* 연결된 저자 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">연결된 저자</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0">
              <svg width="18" height="16" viewBox="0 0 40 36" fill="#E8820C" aria-hidden="true">
                <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
              </svg>
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[1.125rem] text-[#1F2937]">{seniorName || '연결된 저자 없음'}</p>
                {relationship && (
                  <span className="bg-[#FFF0DC] border border-[#E8820C] rounded-full px-2 py-0.5">
                    <span className="text-xs text-[#E8820C]">{relationship}</span>
                  </span>
                )}
              </div>
              {seniorName && (
                <span className="inline-flex items-center gap-1 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  <span className="text-base text-[#16A34A]">연결됨</span>
                </span>
              )}
            </div>
            {seniorName && (
              <button
                type="button"
                onClick={() => navigate('/r')}
                className="bg-[#FFF0DC] rounded-lg px-3 py-2 shrink-0 min-h-11 text-[1.0625rem] text-[#E8820C]"
              >
                책장 바로가기 ›
              </button>
            )}
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">알림</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0">
                <BookOpen size={20} className="text-[#E8820C]" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">새 책 출간 알림</p>
                <p className="text-base text-[#6B7280]">저자가 새 책을 출간하면 알려줘요</p>
              </div>
              <Toggle on={notifNewBook} onChange={setNotifNewBook} />
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0">
                <Bell size={20} className="text-[#E8820C]" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">댓글 답장 알림</p>
                <p className="text-base text-[#6B7280]">내 댓글에 저자가 답장하면 알려줘요</p>
              </div>
              <Toggle on={notifReply} onChange={setNotifReply} />
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
                <Users size={20} className="text-[#9CA3AF]" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">다른 가족 댓글</p>
                <p className="text-base text-[#6B7280]">다른 가족이 댓글을 남기면 알려줘요</p>
              </div>
              <Toggle on={notifFamily} onChange={setNotifFamily} />
            </div>
          </div>
        </div>

        {/* 화면 설정 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">화면 설정</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0 text-lg text-[#6B7280] font-medium">
                가
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <p className="text-[1.125rem] text-[#1F2937]">글씨 크기</p>
                <div className="flex gap-2">
                  {FONT_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFontSize(value)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-base transition-colors',
                        fontSize === value ? 'bg-[#E8820C] text-white' : 'bg-[#F3F4F6] text-[#6B7280]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0 text-lg text-[#6B7280]">
                ◑
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <p className="text-[1.125rem] text-[#1F2937]">다크 모드</p>
                <p className="text-base text-[#6B7280]">어두운 화면으로 보기</p>
              </div>
              <Toggle on={darkModeOn} onChange={setDarkModeOn} />
            </div>
          </div>
        </div>

        {/* 로그아웃 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut()
              useAuthStore.getState().clear()
              navigate('/login', { replace: true })
            }}
            className="w-full py-4 text-center min-h-11"
          >
            <span className="text-[1.125rem] text-[#6B7280]">로그아웃</span>
          </button>
        </div>

        <p className="text-sm text-[#D1D5DB] text-center pb-2">AI 말동무 v1.0.0 · 오브젠</p>

      </main>
    </div>
  )
}
