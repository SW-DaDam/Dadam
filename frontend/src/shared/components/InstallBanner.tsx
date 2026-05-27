import { X } from 'lucide-react'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'

function IosShareIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
      <path
        d="M9 1L5.5 4.5M9 1L12.5 4.5M9 1V14"
        stroke="#1F2937"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 8H1.5C1.224 8 1 8.224 1 8.5V20C1 20.276 1.224 20.5 1.5 20.5H16.5C16.776 20.5 17 20.276 17 20V8.5C17 8.224 16.776 8 16.5 8H15"
        stroke="#1F2937"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function InstallBanner() {
  const { platform, visible, install, dismiss } = useInstallPrompt()

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <div className="bg-white border border-[#E8820C]/40 rounded-2xl shadow-lg p-4 flex items-start gap-3">
        {/* 아이콘 */}
        <div className="w-11 h-11 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0">
          {platform === 'ios' ? (
            <IosShareIcon />
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2v10M6 8l4 4 4-4"
                stroke="#E8820C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2"
                stroke="#E8820C"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-[#1F2937]">홈화면에 추가하기</p>

          {platform === 'ios' ? (
            <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
              Safari 하단{' '}
              <span className="inline-flex items-center gap-0.5 align-middle">
                <IosShareIcon />
              </span>{' '}
              버튼을 탭한 후{' '}
              <span className="font-medium text-[#1F2937]">홈 화면에 추가</span>를 선택하세요
            </p>
          ) : (
            <>
              <p className="text-sm text-[#6B7280] mt-0.5">
                앱처럼 편리하게 다담을 이용할 수 있어요
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-2 bg-[#E8820C] text-white text-sm rounded-xl px-4 py-2 min-h-11"
              >
                홈화면에 추가
              </button>
            </>
          )}
        </div>

        {/* 닫기 */}
        <button
          type="button"
          onClick={dismiss}
          className="w-9 h-9 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5"
          aria-label="닫기"
        >
          <X size={16} className="text-[#9CA3AF]" />
        </button>
      </div>
    </div>
  )
}
