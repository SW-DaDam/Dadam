import { useRef, useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Send } from 'lucide-react'
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
  const { state, messages, transcript, error, isSttSupported,
          isFatalError, startListening, stopListening,
          sendTextMessage, retryFromFatal } =
    useVoiceChat(seniorId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [textInput, setTextInput] = useState('')

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

  const handleTextSend = useCallback(async () => {
    if (!textInput.trim()) return
    await sendTextMessage(textInput)
    setTextInput('')
  }, [textInput, sendTextMessage])

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleTextSend()
    }
  }, [handleTextSend])

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

      {/* 텍스트 입력 영역 */}
      <div className="w-full bg-white border-t border-[#E5E7EB] flex items-center gap-2 px-4 py-3 shrink-0">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleTextKeyDown}
          placeholder={isSttSupported ? '메시지를 입력하세요' : '여기에 말씀을 입력해 주세요'}
          disabled={state !== 'idle'}
          className="flex-1 bg-[#FFF8F0] rounded-xl px-4 py-3 text-[1.0625rem] text-[#1F2937] placeholder:text-[#9CA3AF] outline-none min-h-11 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void handleTextSend()}
          disabled={!textInput.trim() || state !== 'idle'}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#E8820C] text-white disabled:opacity-40 shrink-0"
        >
          <Send size={20} />
        </button>
      </div>

      {/* 마이크 영역 — STT 지원 브라우저에서만 표시 */}
      {isSttSupported && (
        <div className="w-full bg-white flex flex-col items-center px-4 sm:px-6 pt-3 pb-8 gap-4 shrink-0">
          {/* 복구 불가 에러 — 재시도 버튼 표시 */}
          {isFatalError ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-lg text-[#EF4444] text-center font-medium">{error}</p>
              <button
                type="button"
                onClick={retryFromFatal}
                className="min-h-11 px-6 py-3 rounded-xl bg-[#E8820C] text-white text-lg font-medium"
              >
                다시 시도하기
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* STT 미지원 안내 — 텍스트 입력 유도 */}
      {!isSttSupported && (
        <div className="w-full bg-white flex flex-col items-center px-4 pb-8 pt-4 gap-2 shrink-0">
          <p className="text-lg text-[#6B7280] text-center">
            이 브라우저에서는 음성 인식이 지원되지 않아요
          </p>
          <p className="text-base text-[#9CA3AF] text-center">아래 입력창으로 대화해 주세요</p>
        </div>
      )}

    </div>
  )
}
