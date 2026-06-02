import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, BellRing, ChevronRight } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { useAuthStore } from '@/shared/stores/authStore'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'
import IosInstallGuide from '@/shared/components/IosInstallGuide'
import { usePushSubscription } from '@/shared/hooks/usePushSubscription'
import { useThemeStore } from '@/shared/stores/themeStore'
import { useFontSizeStore, type FontSize } from '@/shared/stores/fontSizeStore'
import { useMemory } from '@/features/memory/hooks/useMemory'
import { useInvite } from '@/features/family/hooks/useInvite'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: '작음' },
  { value: 'medium', label: '중간' },
  { value: 'large', label: '큼' },
]

export default function SeniorSettingsPage() {
  const navigate = useNavigate()
  const { darkMode, setDarkMode } = useThemeStore()
  const { fontSize, setFontSize } = useFontSizeStore()
  const user = useAuthStore((s) => s.user)

  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const displayName: string = user?.user_metadata?.full_name ?? user?.email ?? '사용자'
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null
  const avatarChar = displayName.charAt(0)
  // DB에서 저장된 호칭 사용, 없으면 프로필 로드 전 기본값
  const nickname: string = profile?.display_name ?? '...'

  // 스토어에 profile이 없을 때 DB에서 직접 조회
  useEffect(() => {
    if (profile || !user) return
    void supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [user, profile, setProfile])

  const { items: memoryItems } = useMemory(user?.id ?? '')
  const { familyMembers } = useInvite()
  const { platform, install } = useInstallPrompt()
  const [showIosGuide, setShowIosGuide] = useState(false)
  const showInstallRow = platform === 'android' || platform === 'ios'
  const { supported: pushSupported, subscribed: pushSubscribed, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription()

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-center px-4 sm:px-6 shrink-0">
        <h1 className="text-lg sm:text-xl text-[#1F2937] font-medium">설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

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
            <p className="text-[1.0625rem] text-[#6B7280]">저자</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/s/settings/profile')}
            className="bg-[#FFF0DC] rounded-lg px-3 py-2 text-[1.0625rem] text-[#E8820C] shrink-0 min-h-11"
          >
            프로필 편집
          </button>
        </div>

        {/* AI 말동무 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">AI 말동무</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {/* AI가 기억하는 것들 */}
            <button
              type="button"
              onClick={() => navigate('/s/memory')}
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg text-[#E8820C]">
                ✦
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">AI가 기억하는 것들</p>
                <p className="text-base text-[#6B7280]">취미, 가족, 추억 등 쌓인 기억 확인</p>
              </div>
              {memoryItems.length > 0 && (
                <span className="bg-[#FFF0DC] rounded-lg px-2 py-1 text-sm text-[#E8820C] shrink-0">{memoryItems.length}개</span>
              )}
              <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />
            </button>
            {/* AI 목소리 설정 */}
            <button
              type="button"
              onClick={() => navigate('/s/settings/voice')}
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg text-[#E8820C]">
                ♪
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">AI 설정</p>
                <p className="text-base text-[#6B7280]">AI 목소리, 말투 변경</p>
              </div>
              <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />
            </button>
          </div>
        </div>

        {/* 가족 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">가족</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {/* 가족 초대하기 */}
            <button
              type="button"
              onClick={() => navigate('/s/family/invite')}
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg text-[#E8820C]">
                ＋
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">독자 초대하기</p>
                <p className="text-base text-[#6B7280]">카카오 링크로 가족, 지인 초대</p>
              </div>
              <span className="bg-[#E8820C] rounded-lg px-3 py-1.5 text-sm text-white shrink-0">링크 공유</span>
              <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />
            </button>
            {/* 연결된 가족 */}
            <button
              type="button"
              onClick={() => navigate('/s/family/members')}
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg text-[#E8820C]">
                ♥
              </div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">연결된 독자</p>
                <p className="text-base text-[#6B7280]">
                  {familyMembers.length === 0
                    ? '아직 연결된 독자가 없어요'
                    : familyMembers.slice(0, 2).map(m => m.profile?.display_name ?? '독자').join(', ')
                      + (familyMembers.length > 2 ? ` 외 ${familyMembers.length - 2}명` : '')}
                </p>
              </div>
              {familyMembers.length > 0 && (
                <span className="bg-[#FFF0DC] rounded-lg px-2 py-1 text-sm text-[#E8820C] shrink-0">{familyMembers.length}명</span>
              )}
              <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />
            </button>
          </div>
        </div>

        {/* 화면 설정 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">화면 설정</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {/* 글씨 크기 */}
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
                        fontSize === value
                          ? 'bg-[#E8820C] text-white'
                          : 'bg-[#F3F4F6] text-[#6B7280]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* 푸시 알림 */}
            {pushSupported && (
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0">
                  <BellRing size={20} className="text-[#E8820C]" />
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.125rem] text-[#1F2937]">푸시 알림</p>
                  <p className="text-base text-[#6B7280]">댓글·답장 알림을 받아요</p>
                </div>
                <Toggle on={pushSubscribed} onChange={(v) => v ? pushSubscribe() : pushUnsubscribe()} />
              </div>
            )}
            {/* 다크 모드 */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0 text-lg text-[#6B7280]">
                ◑
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <p className="text-[1.125rem] text-[#1F2937]">다크 모드</p>
                <p className="text-base text-[#6B7280]">어두운 화면으로 보기</p>
              </div>
              <Toggle on={darkMode} onChange={setDarkMode} />
            </div>
            {/* 홈화면 추가 */}
            {showInstallRow && (
              <button
                type="button"
                onClick={platform === 'ios' ? () => setShowIosGuide(true) : install}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0 text-lg text-[#6B7280]">
                  ⊞
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.125rem] text-[#1F2937]">홈 화면에 추가</p>
                  <p className="text-base text-[#6B7280]">
                    {platform === 'ios' ? 'Safari에서 홈 화면에 추가하는 방법' : '앱처럼 빠르게 실행할 수 있어요'}
                  </p>
                </div>
                {platform === 'ios' && <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />}
              </button>
            )}
          </div>
        </div>

        {/* 기타 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">기타</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl">
            <button
              type="button"
              onClick={() => navigate('/s/settings/notifications')}
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
                <Bell size={20} className="text-[#6B7280]" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <p className="text-[1.125rem] text-[#1F2937]">알림 설정</p>
                <p className="text-base text-[#6B7280]">댓글, 독자 활동 알림</p>
              </div>
              <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />
            </button>
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

        {/* 앱 버전 */}
      </main>
      {showIosGuide && <IosInstallGuide onClose={() => setShowIosGuide(false)} />}
    </div>
  )
}
