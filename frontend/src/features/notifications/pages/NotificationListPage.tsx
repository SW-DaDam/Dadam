import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

interface Noti {
  id: number
  read: boolean
  avatarType: 'kakao-yellow' | 'kakao-green' | 'ai'
  title: string
  preview: string
  meta: string
  actionLabel?: string
  emoji?: string
}

const NOTIFICATIONS: Noti[] = [
  {
    id: 1, read: false,
    avatarType: 'kakao-yellow',
    title: '아들 민준이가 댓글을 달았어요',
    preview: '"엄마, 토마토 사진 보내주세요!"',
    meta: '4월 책 · 챕터 1 · 1시간 전',
    actionLabel: '음성 답장하기',
  },
  {
    id: 2, read: false,
    avatarType: 'kakao-green',
    title: '수빈이가 문장에 밑줄을 그었어요',
    preview: '"빨간 토마토 다섯 개를 수확했는데..."',
    meta: '4월 책 · 챕터 1 · 3시간 전',
    actionLabel: '확인하러 가기',
  },
  {
    id: 3, read: false,
    avatarType: 'ai',
    title: '4월 책 초안이 완성됐어요!',
    preview: '18번의 대화로 챕터 3개가 만들어졌어요',
    meta: '오늘 오전 9시',
    actionLabel: '책 편집하러 가기',
  },
  {
    id: 4, read: true,
    emoji: '🖼',
    avatarType: 'kakao-yellow',
    title: '박지영이 3월 책에 사진을 추가했어요',
    preview: '',
    meta: '3월 책 · 어제 오후 2시',
    actionLabel: '보러가기',
  },
  {
    id: 5, read: true,
    emoji: '💬',
    avatarType: 'kakao-yellow',
    title: '민준이가 3월 책에 댓글을 달았어요',
    preview: '',
    meta: '3월 책 · 3일 전',
    actionLabel: '보러가기',
  },
  {
    id: 6, read: true,
    emoji: '🎉',
    avatarType: 'ai',
    title: '3월 책이 가족 책장에 출간됐어요',
    preview: '',
    meta: '3월 31일',
    actionLabel: '보러가기',
  },
  {
    id: 7, read: true,
    emoji: '💬',
    avatarType: 'kakao-green',
    title: '수빈이가 3월 책에 댓글을 달았어요',
    preview: '',
    meta: '3월 31일',
    actionLabel: '보러가기',
  },
  {
    id: 8, read: true,
    emoji: '♥',
    avatarType: 'kakao-yellow',
    title: '박지영이 초대를 수락했어요',
    preview: '',
    meta: '가족으로 연결됐어요 · 3월 28일',
  },
  {
    id: 9, read: true,
    avatarType: 'ai',
    title: '3월 책 초안이 완성됐었어요',
    preview: '',
    meta: '3월 31일',
  },
]

function UnreadAvatar({ type }: { type: Noti['avatarType'] }) {
  if (type === 'kakao-yellow') {
    return (
      <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
        <svg width="16" height="15" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
          <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
        </svg>
      </div>
    )
  }
  if (type === 'kakao-green') {
    return (
      <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
        <svg width="16" height="15" viewBox="0 0 40 36" fill="#16A34A8C" aria-hidden="true">
          <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
        </svg>
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
      <span className="text-sm text-white font-bold">AI</span>
    </div>
  )
}

function ReadAvatar({ noti }: { noti: Noti }) {
  if (noti.emoji) {
    return (
      <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0 text-base">
        {noti.emoji}
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
      <span className="text-xs text-[#9CA3AF] font-bold">AI</span>
    </div>
  )
}

export default function NotificationListPage() {
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
                  {/* 왼쪽 강조 바 */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E8820C]" />
                  {/* 오른쪽 점 */}
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#E8820C]" />

                  <div className="pl-4 pr-5 py-4 flex items-start gap-3">
                    <UnreadAvatar type={n.avatarType} />
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <p className="text-[1.125rem] text-[#1F2937] pr-4">{n.title}</p>
                      {n.preview && <p className="text-base text-[#1F2937]">{n.preview}</p>}
                      <p className="text-sm text-[#6B7280]">{n.meta}</p>
                    </div>
                  </div>

                  {n.actionLabel && (
                    <div className="px-5 pb-4 flex justify-end">
                      <button
                        type="button"
                        className="bg-[#E8820C] rounded-xl px-4 py-2 min-h-11"
                      >
                        <span className="text-sm text-white">{n.actionLabel}</span>
                      </button>
                    </div>
                  )}
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
                  <ReadAvatar noti={n} />
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <p className="text-[1.0625rem] text-[#6B7280]">{n.title}</p>
                    <p className="text-sm text-[#9CA3AF]">{n.meta}</p>
                  </div>
                  {n.actionLabel && (
                    <button
                      type="button"
                      className="bg-[#F3F4F6] rounded-lg px-3 py-1.5 shrink-0 min-h-11"
                    >
                      <span className="text-sm text-[#9CA3AF]">{n.actionLabel} ›</span>
                    </button>
                  )}
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
