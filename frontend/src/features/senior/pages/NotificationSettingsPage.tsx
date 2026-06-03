import { useNavigate } from 'react-router'
import { BellRing, ChevronLeft, Info, Moon } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { usePushSubscription } from '@/shared/hooks/usePushSubscription'
import { useNotificationPrefs } from '@/features/notifications/hooks/useNotificationPrefs'

export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const { supported: pushSupported, subscribed: pushSubscribed, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription()
  const { disableAll, enableAll } = useNotificationPrefs()

  async function handlePushToggle(on: boolean) {
    if (on) { await pushSubscribe(); enableAll() }
    else { await pushUnsubscribe(); disableAll() }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">알림 설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 푸시 알림 */}
        {pushSupported && (
          <div className="w-full bg-[#E8820C] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BellRing size={20} className="text-white" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-xl text-white">푸시 알림</p>
              <p className="text-base text-white opacity-80">
                {pushSubscribed ? '기기 알림이 켜져 있어요' : '꺼지면 모든 알림이 오지 않아요'}
              </p>
            </div>
            <Toggle on={pushSubscribed} onChange={handlePushToggle} />
          </div>
        )}

        {/* 알림 받지 않을 시간 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">알림 받지 않을 시간</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
              <Moon size={20} className="text-[#6B7280]" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <p className="text-[1.0625rem] text-[#1F2937]">밤 10시 ~ 아침 7시</p>
              <p className="text-sm text-[#6B7280]">이 시간에는 알림이 오지 않아요</p>
            </div>
            <button type="button" className="bg-[#FFF0DC] rounded-lg px-3 py-2 text-base text-[#E8820C] shrink-0 min-h-11">
              시간 바꾸기
            </button>
          </div>
        </div>

        {/* 카카오 안내 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <Info size={18} className="text-[#6B7280]" />
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <p className="text-sm text-[#6B7280]">알림은 카카오톡 메시지로도 함께 와요</p>
            <p className="text-sm text-[#6B7280]">카카오 알림 설정은 카카오 앱에서 바꿀 수 있어요</p>
          </div>
        </div>

      </main>
    </div>
  )
}
