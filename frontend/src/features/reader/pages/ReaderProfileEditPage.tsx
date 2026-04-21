import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { cn } from '@/lib/utils'

const RELATION_PRESETS = ['아들', '딸', '손자', '손녀', '사위', '직접 입력']

export default function ReaderProfileEditPage() {
  const navigate = useNavigate()
  const [relation, setRelation] = useState('아들')
  const [notifBook, setNotifBook] = useState(true)
  const [notifReply, setNotifReply] = useState(true)

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex flex-col items-center justify-center min-h-11 min-w-11"
        >
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">
          프로필 편집
        </h1>
        <button
          type="button"
          className="ml-auto bg-[#E8820C] rounded-xl px-4 py-2 min-h-11"
        >
          <span className="text-[1.0625rem] text-white">저장</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-[160px] w-full max-w-2xl mx-auto">

        {/* 프로필 사진 */}
        <div className="bg-white border-b border-[#E5E7EB] flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#FEE500] flex items-center justify-center">
              <svg width="28" height="25" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
                <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
              </svg>
            </div>
            <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#FEE500] border-[3px] border-white flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#3C1E1E]">K</span>
            </span>
          </div>
          <p className="text-base text-[#6B7280]">카카오 프로필 사진이 자동으로 사용돼요</p>
        </div>

        <div className="flex flex-col gap-5 px-4 sm:px-6 py-5">

          {/* 이름 필드 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-base text-[#6B7280]">이름</p>
            <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-4 py-3.5 flex items-center gap-3">
              <span className="flex-1 text-[1.25rem] text-[#9CA3AF]">김민준</span>
              <span className="bg-[#E5E7EB] rounded-lg px-3 py-1">
                <span className="text-sm text-[#6B7280]">카카오에서 가져와요</span>
              </span>
            </div>
            <p className="text-[0.9375rem] text-[#9CA3AF]">이름은 카카오 앱에서 변경할 수 있어요</p>
          </div>

          {/* 저자와의 관계 필드 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-base text-[#6B7280]">저자와의 관계</p>
            <div className="bg-white border-2 border-[#E8820C] rounded-xl px-4 py-3.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E8820C] shrink-0" />
              <span className="flex-1 text-[1.375rem] text-[#1F2937]">{relation}</span>
              <button
                type="button"
                onClick={() => setRelation('')}
                className="w-9 h-9 rounded-lg bg-[#E5E7EB] flex items-center justify-center"
              >
                <span className="text-base text-[#6B7280]">✕</span>
              </button>
            </div>

            {/* 미리보기 배너 */}
            {relation && (
              <div className="bg-[#FFF0DC] rounded-xl py-2.5 text-center">
                <span className="text-base text-[#E8820C]">저자에게 "{relation}"로 표시돼요</span>
              </div>
            )}

            {/* 자주 쓰는 관계 */}
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-base text-[#6B7280]">자주 쓰는 관계</p>
              <div className="flex flex-wrap gap-2">
                {RELATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRelation(preset === '직접 입력' ? '' : preset)}
                    className={cn(
                      'rounded-xl px-4 py-2 min-h-11 border',
                      relation === preset
                        ? 'bg-[#FFF0DC] border-[#E8820C]'
                        : 'bg-[#F3F4F6] border-[#E5E7EB]'
                    )}
                  >
                    <span
                      className={cn(
                        'text-[1.125rem]',
                        relation === preset ? 'text-[#E8820C]' : 'text-[#6B7280]'
                      )}
                    >
                      {preset}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 연결된 저자 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-base text-[#6B7280]">연결된 저자</p>
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
                <svg width="16" height="14" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
                  <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
                </svg>
              </div>
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[1.125rem] text-[#1F2937]">김영숙</p>
                <span className="inline-flex self-start bg-[#FFF0DC] rounded-lg px-2 py-0.5">
                  <span className="text-sm text-[#E8820C]">엄마</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-[#DCFCE7] rounded-full px-2.5 py-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  <span className="text-sm text-[#16A34A]">연결됨</span>
                </span>
                <button type="button" className="bg-[#FEF2F2] rounded-lg px-3 py-1.5 min-h-9">
                  <span className="text-sm text-[#DC2626]">해제</span>
                </button>
              </div>
            </div>
          </div>

          {/* 알림 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-base text-[#6B7280]">알림</p>
            <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#E5E7EB]">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.125rem] text-[#1F2937]">책 출간 알림</p>
                  <p className="text-[0.9375rem] text-[#6B7280]">저자가 새 책을 출간하면 알려줘요</p>
                </div>
                <Toggle on={notifBook} onChange={setNotifBook} />
              </div>
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.125rem] text-[#1F2937]">댓글 답장 알림</p>
                  <p className="text-[0.9375rem] text-[#6B7280]">내 댓글에 저자가 답장하면 알려줘요</p>
                </div>
                <Toggle on={notifReply} onChange={setNotifReply} />
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* 하단 저장 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4 flex flex-col gap-3 max-w-2xl mx-auto">
        <p className="text-base text-[#6B7280] text-center">변경 사항은 저장 버튼을 눌러야 적용돼요</p>
        <button type="button" className="w-full bg-[#E8820C] rounded-2xl py-4 text-center">
          <span className="text-[1.375rem] text-white">저장하기</span>
        </button>
      </div>

    </div>
  )
}
