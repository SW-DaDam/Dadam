import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Play } from 'lucide-react'

interface Noti {
  id: number
  read: boolean
  avatarType: 'book' | 'kakao' | 'emoji'
  emoji?: string
  emojiColor?: string
  avatarBg: string
  title: string
  preview: string
  meta: string
  actionLabel: string
  actionVariant: 'orange' | 'gray'
  hasPlay?: boolean
}

const NOTIFICATIONS: Noti[] = [
  {
    id: 1, read: false,
    avatarType: 'book', avatarBg: '#E8820C',
    title: '엄마가 새 책을 출간했어요!',
    preview: '"봄날의 기록" 4월 이야기가 완성됐어요',
    meta: '방금 전',
    actionLabel: '지금 읽기', actionVariant: 'orange',
  },
  {
    id: 2, read: false,
    avatarType: 'kakao', avatarBg: '#FEE500',
    title: '엄마가 댓글에 답장했어요',
    preview: '3월 책 챕터 2에 음성 답장이 왔어요',
    meta: '30분 전',
    actionLabel: '답장 듣기', actionVariant: 'orange', hasPlay: true,
  },
  {
    id: 3, read: true,
    avatarType: 'emoji', emoji: '🖼', emojiColor: '#16A34A', avatarBg: '#DCFCE7',
    title: '이수빈이 3월 책에 사진을 추가했어요',
    preview: '', meta: '3월 책 · 어제 오후 3시',
    actionLabel: '보러가기 ›', actionVariant: 'gray',
  },
  {
    id: 4, read: true,
    avatarType: 'emoji', emoji: '✏', emojiColor: '#E8820C', avatarBg: '#FFF0DC',
    title: '박지영이 4월 챕터 1을 하이라이트했어요',
    preview: '', meta: '4월 책 · 어제 오전 11시',
    actionLabel: '보러가기 ›', actionVariant: 'gray',
  },
  {
    id: 5, read: true,
    avatarType: 'emoji', emoji: '📖', emojiColor: '#9CA3AF', avatarBg: '#F3F4F6',
    title: '엄마의 3월 책이 출간됐어요',
    preview: '"봄비 내리는 날" · 3월 31일',
    meta: '3월 31일',
    actionLabel: '읽어보기 ›', actionVariant: 'gray',
  },
  {
    id: 6, read: true,
    avatarType: 'emoji', emoji: '💬', emojiColor: '#9CA3AF', avatarBg: '#F3F4F6',
    title: '이수빈이 3월 책에 댓글을 달았어요',
    preview: '', meta: '3월 챕터 1 · 3월 31일',
    actionLabel: '보러가기 ›', actionVariant: 'gray',
  },
  {
    id: 7, read: true,
    avatarType: 'emoji', emoji: '✦', emojiColor: '#9CA3AF', avatarBg: '#F3F4F6',
    title: '이번 주 엄마의 이야기 요약',
    preview: '텃밭, 수빈이, 봄비 · 3월 25일 월요일',
    meta: '3월 25일',
    actionLabel: '보러가기 ›', actionVariant: 'gray',
  },
  {
    id: 8, read: true,
    avatarType: 'emoji', emoji: '📖', emojiColor: '#9CA3AF', avatarBg: '#F3F4F6',
    title: '엄마의 2월 책이 출간됐어요',
    preview: '"겨울 끝자락" · 2월 28일',
    meta: '2월 28일',
    actionLabel: '읽어보기 ›', actionVariant: 'gray',
  },
]

function Avatar({ noti }: { noti: Noti }) {
  if (noti.avatarType === 'book') {
    return (
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl" style={{ backgroundColor: noti.avatarBg }}>
        <span>📖</span>
      </div>
    )
  }
  if (noti.avatarType === 'kakao') {
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: noti.avatarBg }}>
        <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
          <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
        </svg>
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl" style={{ backgroundColor: noti.avatarBg }}>
      <span style={{ color: noti.emojiColor }}>{noti.emoji}</span>
    </div>
  )
}

export default function ReaderNotificationPage() {
  const navigate = useNavigate()
  const [notis, setNotis] = useState(NOTIFICATIONS)

  const unread = notis.filter((n) => !n.read)
  const read = notis.filter((n) => n.read)

  function markAllRead() {
    setNotis((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">알림</h1>
        <button
          type="button"
          onClick={markAllRead}
          className="ml-auto bg-[#FFF0DC] rounded-lg px-3 py-1.5 min-h-11"
        >
          <span className="text-sm text-[#E8820C]">모두 읽음 처리</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 안 읽은 알림 */}
        {unread.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280] px-1">안 읽은 알림 {unread.length}개</p>
            <div className="flex flex-col gap-2">
              {unread.map((n) => (
                <div
                  key={n.id}
                  className="relative bg-[#FFF0DC] border-[1.5px] border-[#E8820C] rounded-2xl overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E8820C]" />
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#E8820C]" />

                  <div className="pl-4 pr-5 py-4 flex items-start gap-3">
                    <Avatar noti={n} />
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0 pr-4">
                      <p className="text-[1.125rem] text-[#1F2937]">{n.title}</p>
                      {n.preview && <p className="text-base text-[#1F2937]">{n.preview}</p>}
                      <p className="text-sm text-[#6B7280]">{n.meta}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-4 flex justify-end">
                    <button type="button" className="bg-[#E8820C] rounded-xl px-4 py-2 flex items-center gap-1.5 min-h-11">
                      {n.hasPlay && <Play size={13} className="text-white fill-white" />}
                      <span className="text-sm text-white">{n.actionLabel}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 읽은 알림 */}
        {read.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-base text-[#6B7280] px-1">읽은 알림</p>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
              {read.map((n) => (
                <div key={n.id} className="flex items-center gap-3 px-5 py-4">
                  <Avatar noti={n} />
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <p className="text-[1.0625rem] text-[#6B7280]">{n.title}</p>
                    <p className="text-sm text-[#9CA3AF]">{n.preview || n.meta}</p>
                    {n.preview && <p className="text-sm text-[#9CA3AF]">{n.meta}</p>}
                  </div>
                  <button type="button" className="bg-[#F3F4F6] rounded-lg px-3 py-1.5 shrink-0 min-h-11">
                    <span className="text-sm text-[#9CA3AF]">{n.actionLabel}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 더보기 */}
        <div className="flex flex-col items-center gap-1 py-3">
          <p className="text-base text-[#9CA3AF]">· · ·</p>
          <button type="button">
            <span className="text-base text-[#6B7280]">지난 알림 더 보기</span>
          </button>
        </div>

      </main>
    </div>
  )
}
