import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import AiBadge from './AiBadge'

interface ChatBubbleProps {
  role: 'ai' | 'user'
  lines: string[]
  time: string
  onReplay?: () => void
}

// AI 또는 사용자 발화를 말풍선으로 렌더링하는 컴포넌트
export default function ChatBubble({ role, lines, time, onReplay }: ChatBubbleProps) {
  if (role === 'ai') {
    return (
      <div className="flex items-end gap-2 max-w-[80%]">
        <AiBadge />
        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-1">
            <div className="bg-[#FFF0DC] rounded-2xl rounded-bl-sm px-4 py-3">
              {lines.map((line) => (
                <p key={line} className="text-content text-[#1F2937]">{line}</p>
              ))}
            </div>
            {onReplay && (
              <button
                type="button"
                onClick={onReplay}
                aria-label="다시 듣기"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#FFF0DC] text-[#E8820C] shrink-0 mb-0.5"
              >
                <Volume2 size={15} />
              </button>
            )}
          </div>
          <span className="text-xs text-[#6B7280] pl-1">{time}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1 max-w-[80%] self-end">
      <div className="bg-white border border-[#E8820C] rounded-2xl rounded-br-sm px-4 py-3">
        {lines.map((line) => (
          <p key={line} className={cn('text-content text-[#1F2937] text-right')}>{line}</p>
        ))}
      </div>
      <span className="text-xs text-[#6B7280] pr-1">{time}</span>
    </div>
  )
}
