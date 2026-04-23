import { useState } from 'react'
import { useNavigate } from 'react-router'
import Toggle from '@/shared/components/Toggle'
import { useAuthStore } from '@/shared/stores/authStore'

export default function ReaderSettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '사용자'
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null
  const avatarChar = displayName.charAt(0)

  const [notifNewBook, setNotifNewBook] = useState(true)
  const [notifReply, setNotifReply] = useState(true)
  const [notifFamily, setNotifFamily] = useState(false)
  const [largeFontOn, setLargeFontOn] = useState(false)
  const [darkModeOn, setDarkModeOn] = useState(false)

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-center px-4 sm:px-6 shrink-0">
        <h1 className="text-lg sm:text-xl text-[#1F2937] font-medium">설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 프로필 카드 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-full bg-[#FEE500] flex items-center justify-center overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : <span className="text-base text-[#3C1E1E]">{avatarChar}</span>
              }
            </div>
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#FEE500] border-2 border-white flex items-center justify-center">
              <span className="text-[9px] font-bold text-[#3C1E1E]">K</span>
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
            <p className="text-[1.125rem] text-[#1F2937]">{displayName}</p>
            <p className="text-sm text-[#6B7280]">관계: 아들 · 독자</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/r/settings/profile')}
          className="bg-[#FFF0DC] rounded-xl px-4 py-2 shrink-0 min-h-11"
          >
            <span className="text-sm text-[#E8820C]">프로필 편집</span>
          </button>
        </div>

        {/* 연결된 저자 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">연결된 저자</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-[#FEE500] flex items-center justify-center">
                <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
                  <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[1.0625rem] text-[#1F2937]">김영숙</p>
                <span className="bg-[#FFF0DC] border border-[#E8820C] rounded-full px-2 py-0.5">
                  <span className="text-xs text-[#E8820C]">엄마</span>
                </span>
                <span className="bg-[#DCFCE7] rounded-full px-2 py-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  <span className="text-xs text-[#16A34A]">연결됨</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/r')}
              className="bg-[#FFF0DC] rounded-xl px-3 py-2 shrink-0 min-h-11"
            >
              <span className="text-sm text-[#E8820C]">책장 바로가기 ›</span>
            </button>
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">알림</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#FFF0DC] flex items-center justify-center shrink-0 text-base">
                📖
              </div>
              <p className="flex-1 text-[1.0625rem] text-[#1F2937]">새 책이 출간됐을 때</p>
              <Toggle on={notifNewBook} onChange={setNotifNewBook} />
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#FFF0DC] flex items-center justify-center shrink-0 text-base">
                ↩
              </div>
              <p className="flex-1 text-[1.0625rem] text-[#1F2937]">내 댓글에 답장이 왔을 때</p>
              <Toggle on={notifReply} onChange={setNotifReply} />
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 text-base">
                💬
              </div>
              <p className="flex-1 text-[1.0625rem] text-[#1F2937]">다른 가족 댓글</p>
              <Toggle on={notifFamily} onChange={setNotifFamily} />
            </div>
          </div>
        </div>

        {/* 화면 설정 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">화면 설정</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                <span className="text-[1.125rem] font-medium text-[#6B7280]">가</span>
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.0625rem] text-[#1F2937]">글씨크기</p>
                {!largeFontOn && <p className="text-sm text-[#9CA3AF]">보통 설정 중</p>}
              </div>
              <Toggle on={largeFontOn} onChange={setLargeFontOn} />
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 text-base">
                ◑
              </div>
              <p className="flex-1 text-[1.0625rem] text-[#1F2937]">다크모드</p>
              <Toggle on={darkModeOn} onChange={setDarkModeOn} />
            </div>
          </div>
        </div>

        {/* 기타 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">기타</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            <button type="button" className="w-full flex items-center gap-3 px-5 py-4 text-left">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 text-base">
                □
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.0625rem] text-[#1F2937]">이용약관·개인정보처리방침</p>
                <p className="text-sm text-[#9CA3AF]">오브젠</p>
              </div>
              <span className="text-[#9CA3AF]">›</span>
            </button>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 text-base">
                v
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.0625rem] text-[#1F2937]">앱버전</p>
                <p className="text-sm text-[#9CA3AF]">AI 말동무 v1.0.0</p>
              </div>
              <span className="bg-[#DCFCE7] rounded-full px-2.5 py-1">
                <span className="text-xs text-[#16A34A]">최신 버전</span>
              </span>
            </div>
          </div>
        </div>

        {/* 로그아웃 */}
        <button type="button" className="w-full py-3 text-center">
          <span className="text-base text-[#6B7280]">로그아웃</span>
        </button>

        {/* 푸터 */}
        <p className="text-center text-sm text-[#D1D5DB] pb-4">AI 말동무 v1.0.0 · 오브젠</p>

      </main>
    </div>
  )
}
