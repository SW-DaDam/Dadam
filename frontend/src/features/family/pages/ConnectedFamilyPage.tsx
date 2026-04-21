import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

interface Member {
  id: string
  name: string
  relation: string
  relationColor: string
  relationBg: string
  avatarBg: string
  avatarText: string
  avatarTextColor: string
  lastActivity: string
  comments: number
  extras: { label: string; value: number }
}

const MEMBERS: Member[] = [
  {
    id: '1', name: '김민준', relation: '아들', relationColor: '#E8820C', relationBg: '#FFF0DC',
    avatarBg: '#FEE500', avatarText: '민', avatarTextColor: '#3C1E1E',
    lastActivity: '4월 챕터 1에 댓글을 달았어요 · 1시간 전',
    comments: 12, extras: [{ label: '하이라이트', value: 5 }],
  },
  {
    id: '2', name: '이수빈', relation: '손녀', relationColor: '#16A34A', relationBg: '#DCFCE7',
    avatarBg: '#DCFCE7', avatarText: '빈', avatarTextColor: '#16A34A',
    lastActivity: '3월 책에 사진을 추가했어요 · 어제',
    comments: 8, extras: [{ label: '사진', value: 3 }],
  },
  {
    id: '3', name: '박지영', relation: '딸', relationColor: '#E8820C', relationBg: '#FFF0DC',
    avatarBg: '#FFF0DC', avatarText: '영', avatarTextColor: '#E8820C',
    lastActivity: '4월 책에 하이라이트를 표시했어요 · 2일 전',
    comments: 5, extras: [{ label: '하이라이트', value: 9 }],
  },
]

export default function ConnectedFamilyPage() {
  const navigate = useNavigate()
  const [disconnectTarget, setDisconnectTarget] = useState<Member | null>(null)
  const [members, setMembers] = useState(MEMBERS)

  function handleDisconnect() {
    if (!disconnectTarget) return
    setMembers((prev) => prev.filter((m) => m.id !== disconnectTarget.id))
    setDisconnectTarget(null)
  }

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">연결된 가족</h1>
        <button
          type="button"
          onClick={() => navigate('invite')}
          className="ml-auto bg-[#E8820C] rounded-lg px-3 py-1.5 min-h-11"
        >
          <span className="text-base text-white">+ 초대</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 요약 배너 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="flex">
            {members.map((m, i) => (
              <div
                key={m.id}
                className="w-9 h-9 rounded-full border-2 border-[#FFF0DC] flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: m.avatarBg, color: m.avatarTextColor, marginLeft: i > 0 ? '-8px' : 0 }}
              >
                {m.avatarText}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">가족 {members.length}명이 연결돼 있어요</p>
            <p className="text-base text-[#6B7280]">엄마의 책을 함께 읽고 있어요</p>
          </div>
        </div>

        {/* 가족 목록 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">연결된 가족</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {members.map((m) => (
              <div key={m.id} className="px-5 py-4 flex items-start gap-3">
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-base font-medium"
                    style={{ backgroundColor: m.avatarBg, color: m.avatarTextColor }}
                  >
                    {m.avatarText}
                  </div>
                  {/* 카카오 뱃지 */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FEE500] border-2 border-white flex items-center justify-center">
                    <span className="text-[8px] text-[#3C1E1E] font-bold">K</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xl text-[#1F2937]">{m.name}</p>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: m.relationBg, color: m.relationColor }}
                    >
                      {m.relation}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B7280]">{m.lastActivity}</p>
                  <div className="flex gap-2">
                    <span className="bg-[#F3F4F6] rounded px-2 py-1 text-xs text-[#6B7280]">댓글 {m.comments}개</span>
                    {m.extras.map((e) => (
                      <span key={e.label} className="bg-[#F3F4F6] rounded px-2 py-1 text-xs text-[#6B7280]">{e.label} {e.value}개</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDisconnectTarget(m)}
                  className="bg-[#FEF2F2] rounded-lg px-3 py-1.5 shrink-0 min-h-11"
                >
                  <span className="text-sm text-[#DC2626]">연결 해제</span>
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* 연결 해제 다이얼로그 */}
      {disconnectTarget && (
        <div className="absolute inset-0 bg-[#1F2937]/40 flex items-center justify-center z-50 px-10">
          <div className="w-full bg-white rounded-2xl px-6 py-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <span className="text-2xl text-[#DC2626] font-bold">!</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[1.375rem] text-[#1F2937] text-center">연결을 해제할까요?</p>
              <p className="text-[1.0625rem] text-[#6B7280] text-center">
                {disconnectTarget.name} 님이 책장을 볼 수 없게 돼요
              </p>
            </div>
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={() => setDisconnectTarget(null)}
                className="flex-1 h-14 rounded-xl bg-[#F3F4F6] text-[1.0625rem] text-[#6B7280]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex-1 h-14 rounded-xl bg-[#DC2626] text-[1.0625rem] text-white"
              >
                해제하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
