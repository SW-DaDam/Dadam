type Props = { onClose: () => void }

// iOS Safari 공유 버튼 아이콘 (실제 모양과 동일)
function SafariShareIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 24" fill="none" aria-hidden="true" className="inline-block shrink-0">
      <line x1="10" y1="1" x2="10" y2="14" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 5l4-4 4 4" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11v10a1 1 0 001 1h14a1 1 0 001-1V11" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0 text-white text-sm font-bold mt-0.5">
        {num}
      </div>
      <div className="flex-1 text-[1.0625rem] text-[#1F2937]">{children}</div>
    </div>
  )
}

export default function IosInstallGuide({ onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] bg-white rounded-t-2xl px-6 pt-6 pb-10 z-50">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-[#1F2937]">홈 화면에 추가하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-[#6B7280] text-xl"
          >
            ✕
          </button>
        </div>

        {/* 단계 */}
        <div className="flex flex-col gap-5">
          <Step num={1}>
            <span>Safari 하단의 공유 버튼 </span>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#D1D5DB] bg-[#F3F4F6] align-middle mx-0.5">
              <SafariShareIcon />
            </span>
            <span> 을 탭해요</span>
          </Step>

          <Step num={2}>
            <span>목록에서 </span>
            <span className="font-medium text-[#1F2937]">"홈 화면에 추가"</span>
            <span> 를 선택해요</span>
          </Step>

          <Step num={3}>
            <span>오른쪽 위의 </span>
            <span className="font-medium text-[#1F2937]">"추가"</span>
            <span> 를 탭해요</span>
          </Step>
        </div>

        <div className="mt-6 bg-[#FFF8F0] rounded-xl px-4 py-3">
          <p className="text-sm text-[#6B7280] text-center">Safari 브라우저에서만 가능해요</p>
        </div>
      </div>
    </>
  )
}
