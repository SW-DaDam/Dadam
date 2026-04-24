import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

// 마이크 버튼이 가질 수 있는 상태
// idle: 대기, listening: STT 녹음 중, processing: LLM 응답 대기, speaking: TTS 재생 중
export type MicButtonState = 'idle' | 'listening' | 'processing' | 'speaking'

// 상태별 aria-label 매핑
const ARIA_LABELS: Record<MicButtonState, string> = {
  idle: '녹음 시작',
  listening: '녹음 중지',
  processing: 'AI 응답 중',
  speaking: 'AI 말하는 중',
}

interface MicButtonProps {
  state: MicButtonState
  onPress: () => void
}

// 녹음 시작/중지 토글 버튼 (시니어 친화: 120px 원형, 터치 타깃 충족)
// processing/speaking 상태에서는 클릭 불가 (pointer-events-none)
export default function MicButton({ state, onPress }: MicButtonProps) {
  const isActive = state === 'listening'
  const isDisabled = state === 'processing' || state === 'speaking'

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={ARIA_LABELS[state]}
      className={cn(
        'w-[120px] h-[120px] rounded-full flex items-center justify-center transition-all',
        isActive ? 'bg-[#E8820C] animate-pulse' : 'bg-[#FFF0DC]',
        isDisabled && 'pointer-events-none opacity-60',
      )}
    >
      <div
        className={cn(
          'w-[96px] h-[96px] rounded-full flex items-center justify-center',
          isActive ? 'bg-[#E8820C]' : 'bg-[#FFF0DC]',
        )}
      >
        <Mic
          size={40}
          className={isActive ? 'text-white' : 'text-[#E8820C]'}
        />
      </div>
    </button>
  )
}
