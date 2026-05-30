type Props = { onClose: () => void }

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0 text-white text-sm font-bold">
        {num}
      </div>
      <p className="text-[1.0625rem] text-[#1F2937] pt-0.5">{text}</p>
    </div>
  )
}

export default function IosInstallGuide({ onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] bg-white rounded-t-2xl px-6 pt-6 pb-10 z-50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-medium text-[#1F2937]">홈 화면에 추가하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-[#6B7280] text-xl"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <Step num={1} text="Safari 하단의 공유 버튼(□↑)을 탭해요" />
          <Step num={2} text='"홈 화면에 추가"를 선택해요' />
          <Step num={3} text='오른쪽 위의 "추가"를 탭해요' />
        </div>
        <p className="text-sm text-[#9CA3AF] mt-5 text-center">Safari 브라우저에서만 가능해요</p>
      </div>
    </>
  )
}
