import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'ai' | 'user'
interface Message {
  id: number
  role: Role
  lines: string[]
  time: string
}

const DEMO_MESSAGES: Message[] = [
  {
    id: 1,
    role: 'ai',
    lines: ['어제 텃밭에서 토마토 수확하셨다고 하셨는데,', '맛이 어떠셨어요?'],
    time: '오전 9:12',
  },
  {
    id: 2,
    role: 'user',
    lines: ['응, 정말 달고 맛있었어.', '손녀한테도 갖다줬지.'],
    time: '오전 9:13',
  },
  {
    id: 3,
    role: 'ai',
    lines: ['손녀분이 좋아하셨겠어요!', '손녀분 이름이 뭐예요?'],
    time: '오전 9:14',
  },
  {
    id: 4,
    role: 'user',
    lines: ['수빈이야, 이제 중학생이 됐어.'],
    time: '오전 9:15',
  },
]

function AiBadge() {
  return (
    <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
      <span className="text-xs text-white font-bold">AI</span>
    </div>
  )
}

function AiBubble({ lines, time }: { lines: string[]; time: string }) {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      <AiBadge />
      <div className="flex flex-col gap-1">
        <div className="bg-[#FFF0DC] rounded-2xl rounded-bl-sm px-4 py-3">
          {lines.map((l) => (
            <p key={l} className="text-[1.0625rem] text-[#1F2937]">{l}</p>
          ))}
        </div>
        <span className="text-xs text-[#6B7280] pl-1">{time}</span>
      </div>
    </div>
  )
}

function UserBubble({ lines, time }: { lines: string[]; time: string }) {
  return (
    <div className="flex flex-col items-end gap-1 max-w-[80%] self-end">
      <div className="bg-white border border-[#E8820C] rounded-2xl rounded-br-sm px-4 py-3">
        {lines.map((l) => (
          <p key={l} className="text-[1.0625rem] text-[#1F2937] text-right">{l}</p>
        ))}
      </div>
      <span className="text-xs text-[#6B7280] pr-1">{time}</span>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <AiBadge />
      <div className="bg-[#FFF0DC] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        {[1, 0.6, 0.3].map((opacity, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-[#E8820C] animate-bounce"
            style={{ opacity, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const navigate = useNavigate()
  const [isRecording, setIsRecording] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="flex-1 flex flex-col">

      {/* 헤더 */}
      <header className="w-full bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 h-[80px] shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center min-h-11"
        >
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="text-[1.375rem] text-[#1F2937] font-bold">오늘의 대화</h1>
        <span className="text-base text-[#6B7280]">오늘 3번째 대화</span>
      </header>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-5 bg-[#FFF8F0]">
        {DEMO_MESSAGES.map((msg) =>
          msg.role === 'ai'
            ? <AiBubble key={msg.id} lines={msg.lines} time={msg.time} />
            : <UserBubble key={msg.id} lines={msg.lines} time={msg.time} />,
        )}
        <TypingIndicator />
        <div ref={bottomRef} />
      </div>

      {/* 마이크 영역 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] flex flex-col items-center px-4 sm:px-6 pt-4 pb-8 gap-4 shrink-0">
        <div className="w-full bg-[#FFF8F0] rounded-xl px-5 py-3 text-center">
          <p className="text-[1.0625rem] italic text-[#6B7280]">...</p>
        </div>

        <button
          type="button"
          onClick={() => setIsRecording((v) => !v)}
          className={cn(
            'w-[120px] h-[120px] rounded-full flex items-center justify-center transition-all',
            isRecording ? 'bg-[#E8820C]' : 'bg-[#FFF0DC]',
          )}
        >
          <div className={cn(
            'w-[96px] h-[96px] rounded-full flex items-center justify-center',
            isRecording ? 'bg-[#E8820C]' : 'bg-[#FFF0DC]',
          )}>
            <Mic size={40} className={isRecording ? 'text-white' : 'text-[#E8820C]'} />
          </div>
        </button>

        <p className={cn(
          'text-[1.0625rem] font-medium',
          isRecording ? 'text-[#E8820C]' : 'text-[#9CA3AF]',
        )}>
          {isRecording ? '듣고 있어요' : '버튼을 눌러 말씀해주세요'}
        </p>
        <p className="text-base text-[#6B7280] text-center">말씀이 끝나면 자동으로 저장돼요</p>
      </div>

    </div>
  )
}
