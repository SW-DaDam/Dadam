import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'

interface NotifItem {
  id: string
  emoji: string
  title: string
  desc: string
  defaultOn: boolean
}

const FAMILY_NOTIFS: NotifItem[] = [
  { id: 'comment', emoji: '💬', title: '가족이 댓글을 달았을 때', desc: '자녀·손주가 내 책에 댓글을 남기면', defaultOn: true },
  { id: 'reply', emoji: '↩', title: '내 댓글에 답장이 왔을 때', desc: '저자가 내 댓글에 음성 답장을 남기면', defaultOn: true },
  { id: 'photo', emoji: '🖼', title: '가족이 사진을 추가했을 때', desc: '책에 가족 사진이 새로 올라오면', defaultOn: true },
  { id: 'highlight', emoji: '✏️', title: '가족이 하이라이트를 표시했을 때', desc: '책 본문에 밑줄·형광펜이 추가되면', defaultOn: false },
]

const BOOK_NOTIFS: NotifItem[] = [
  { id: 'draft', emoji: '📖', title: '이번 달 책 초안이 완성됐을 때', desc: '월말에 AI가 책 초안을 만들어 두면', defaultOn: true },
  { id: 'publish', emoji: '🎉', title: '책이 가족 책장에 출간됐을 때', desc: '편집을 마친 책이 가족에게 공개되면', defaultOn: true },
  { id: 'remind', emoji: '🌱', title: '오늘 아직 대화를 안 했을 때', desc: '하루에 한 번, 오전에 부드럽게 알려줘요', defaultOn: false },
]

function NotifRow({ item, on, onChange }: { item: NotifItem; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="w-9 h-9 rounded-lg bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg">
        {item.emoji}
      </div>
      <div className="flex-1 flex flex-col gap-0.5">
        <p className="text-[1.0625rem] text-[#1F2937]">{item.title}</p>
        <p className="text-sm text-[#6B7280]">{item.desc}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const [masterOn, setMasterOn] = useState(true)
  const [notifs, setNotifs] = useState<Record<string, boolean>>(
    Object.fromEntries([...FAMILY_NOTIFS, ...BOOK_NOTIFS].map((n) => [n.id, n.defaultOn])),
  )

  function setNotif(id: string, val: boolean) {
    setNotifs((prev) => ({ ...prev, [id]: val }))
  }

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">알림 설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 전체 알림 토글 */}
        <div className="w-full bg-[#E8820C] rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-xl text-white">전체 알림</p>
            <p className="text-base text-white opacity-80">알림을 끄면 모든 알림이 오지 않아요</p>
          </div>
          <Toggle on={masterOn} onChange={setMasterOn} />
        </div>

        {/* 가족 활동 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">가족 활동</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {FAMILY_NOTIFS.map((item) => (
              <NotifRow
                key={item.id}
                item={item}
                on={masterOn && notifs[item.id]}
                onChange={(v) => setNotif(item.id, v)}
              />
            ))}
          </div>
        </div>

        {/* 책 만들기 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">책 만들기</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {BOOK_NOTIFS.map((item) => (
              <NotifRow
                key={item.id}
                item={item}
                on={masterOn && notifs[item.id]}
                onChange={(v) => setNotif(item.id, v)}
              />
            ))}
          </div>
        </div>

        {/* 알림 받지 않을 시간 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">알림 받지 않을 시간</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 text-lg">🌙</div>
            <div className="flex-1 flex flex-col gap-0.5">
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
          <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 text-sm">ℹ</div>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-[#6B7280]">알림은 카카오톡 메시지로도 함께 와요</p>
            <p className="text-sm text-[#6B7280]">카카오 알림 설정은 카카오 앱에서 바꿀 수 있어요</p>
          </div>
        </div>

      </main>
    </div>
  )
}
