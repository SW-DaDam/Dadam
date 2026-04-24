import { useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useVoiceChat } from '@/features/chat/hooks/useVoiceChat'
import { useAuthStore } from '@/shared/stores/authStore'
import ChatBubble from '@/features/chat/components/ChatBubble'
import TypingIndicator from '@/features/chat/components/TypingIndicator'
import MicButton from '@/features/chat/components/MicButton'

// ChatMessage.timestamp(Date) → ChatBubble time(string) 변환
function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function ChatPage() {
  const navigate = useNavigate()
  const seniorId = useAuthStore((s) => s.user?.id ?? '')
  const { state, messages, transcript, error, startListening, stopListening } =
    useVoiceChat(seniorId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 새 메시지 추가 또는 processing 진입 시 하단 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, state])

  // idle → startListening, listening → stopListening
  // processing/speaking은 MicButton pointer-events-none으로 도달 불가
  const handleMicPress = useCallback(() => {
    if (state === 'listening') stopListening()
    else if (state === 'idle') startListening()
  }, [state, startListening, stopListening])

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
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            role={msg.role === 'assistant' ? 'ai' : 'user'}
            lines={msg.content.split('\n').filter(Boolean)}
            time={formatTime(msg.timestamp)}
          />
        ))}
        {state === 'processing' && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* 마이크 영역 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] flex flex-col items-center px-4 sm:px-6 pt-4 pb-8 gap-4 shrink-0">
        <div className="w-full bg-[#FFF8F0] rounded-xl px-5 py-3 text-center">
          <p className="text-[1.0625rem] italic text-[#6B7280]">
            {transcript || error || '...'}
          </p>
        </div>

        <MicButton state={state} onPress={handleMicPress} />

        <p className="text-[1.0625rem] font-medium text-[#9CA3AF]">
          버튼을 눌러 말씀해주세요
        </p>
        <p className="text-base text-[#6B7280] text-center">말씀이 끝나면 자동으로 저장돼요</p>
      </div>

    </div>
  )
}
