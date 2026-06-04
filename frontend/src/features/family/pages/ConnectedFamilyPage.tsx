import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useInvite } from '@/features/family/hooks/useInvite'

const AVATAR_COLORS = [
  { bg: '#FFF0DC', text: '#E8820C' },
  { bg: '#DCFCE7', text: '#16A34A' },
  { bg: '#FEE500', text: '#3C1E1E' },
  { bg: '#F3E8FF', text: '#7C3AED' },
  { bg: '#E0F2FE', text: '#0369A1' },
]

export default function ConnectedFamilyPage() {
  const navigate = useNavigate()
  const { familyMembers, loading, removeFamilyLink } = useInvite()
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const target = familyMembers.find((m) => m.id === disconnectTarget)

  async function handleDisconnect() {
    if (!disconnectTarget) return
    setRemoving(true)
    await removeFamilyLink(disconnectTarget)
    setRemoving(false)
    setDisconnectTarget(null)
  }

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">연결된 독자</h1>
        <button
          type="button"
          onClick={() => navigate('/s/family/invite')}
          className="ml-auto bg-[#E8820C] rounded-lg px-3 py-1.5 min-h-11"
        >
          <span className="text-base text-white">+ 초대</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8820C] border-t-transparent" />
          </div>
        ) : (
          <>
            {/* 요약 배너 */}
            <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className="flex">
                {familyMembers.slice(0, 5).map((m, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  const initial = m.profile?.display_name?.[0] ?? '?'
                  return (
                    <div
                      key={m.id}
                      className="w-9 h-9 rounded-full border-2 border-[#FFF0DC] flex items-center justify-center text-sm font-medium"
                      style={{ backgroundColor: color.bg, color: color.text, marginLeft: i > 0 ? '-8px' : 0 }}
                    >
                      {initial}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[1.0625rem] text-[#1F2937]">
                  {familyMembers.length > 0
                    ? `독자 ${familyMembers.length}명이 연결돼 있어요`
                    : '아직 연결된 독자가 없어요'}
                </p>
                <p className="text-base text-[#6B7280]">
                  {familyMembers.length > 0 ? '함께 책을 읽고 있어요' : '독자를 초대해보세요'}
                </p>
              </div>
            </div>

            {/* 가족 목록 */}
            {familyMembers.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-base text-[#6B7280] px-1">연결된 독자</p>
                <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
                  {familyMembers.map((m, i) => {
                    const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                    const name = m.profile?.display_name ?? '이름 없음'
                    const initial = name[0]
                    return (
                      <div key={m.id} className="px-5 py-4 flex items-start gap-3">
                        <div className="relative shrink-0">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-base font-medium"
                            style={{ backgroundColor: color.bg, color: color.text }}
                          >
                            {initial}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FEE500] border-2 border-white flex items-center justify-center">
                            <span className="text-[8px] text-[#3C1E1E] font-bold">K</span>
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xl text-[#1F2937]">{name}</p>
                            {m.relationship && (
                              <span className="text-xs px-2 py-0.5 rounded bg-[#FFF0DC] text-[#E8820C]">
                                {m.relationship}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#6B7280]">
                            {m.accepted_at
                              ? `${new Date(m.accepted_at).toLocaleDateString('ko-KR')} 연결됨`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDisconnectTarget(m.id)}
                          className="bg-[#FEF2F2] rounded-lg px-3 py-1.5 shrink-0 min-h-11"
                        >
                          <span className="text-sm text-[#DC2626]">연결 해제</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 빈 상태 */}
            {familyMembers.length === 0 && (
              <button
                type="button"
                onClick={() => navigate('/s/family/invite')}
                className="w-full bg-[#E8820C] rounded-2xl py-4 text-xl text-white font-medium min-h-14"
              >
                독자 초대하기
              </button>
            )}
          </>
        )}

      </main>

      {/* 연결 해제 다이얼로그 */}
      {disconnectTarget && target && (
        <div className="absolute inset-0 bg-[#1F2937]/40 flex items-center justify-center z-50 px-10">
          <div className="w-full bg-white rounded-2xl px-6 py-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <span className="text-2xl text-[#DC2626] font-bold">!</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[1.375rem] text-[#1F2937] text-center">연결을 해제할까요?</p>
              <p className="text-[1.0625rem] text-[#6B7280] text-center">
                {target.profile?.display_name ?? '이 독자'} 님이 책장을 볼 수 없게 돼요
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
                disabled={removing}
                className="flex-1 h-14 rounded-xl bg-[#DC2626] text-[1.0625rem] text-white disabled:opacity-60"
              >
                {removing ? '해제 중…' : '해제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
