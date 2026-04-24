// STT(Web Speech API) → Edge Function 스트리밍 → TTS 전체 흐름을 조율하는 훅
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { streamVoiceChat, type VoiceChatMessage } from '@/lib/ai/voiceChatClient'
import type { TablesInsert } from '@/types/database'

// ── 상수 ──────────────────────────────────────────────
const STT_LANG = 'ko-KR'
const TTS_LANG = 'ko-KR'
const TTS_RATE = 0.9
// no-speech 감지 후 자동 재시작까지 대기 시간 (TASK-09)
const NO_SPEECH_RESTART_MS = 5000

// Web Speech API 에러 코드 → 사용자 안내 메시지
const STT_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 사용 권한이 필요해요',
  'no-speech': '말씀이 인식되지 않았어요. 다시 시도해 주세요',
  'network': '네트워크 연결을 확인해 주세요',
  'audio-capture': '마이크를 찾을 수 없어요',
}

// ── 타입 ──────────────────────────────────────────────
// 공식 문서(F-03-voice-chat.md §TASK-03) 4단계 상태 머신
// MicButton이 상태별 스타일·비활성화 처리에 이 타입을 그대로 사용
export type VoiceChatState = 'idle' | 'listening' | 'processing' | 'speaking'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface UseVoiceChatReturn {
  state: VoiceChatState
  messages: ChatMessage[]
  transcript: string       // 실시간 중간 STT 결과 (마이크 영역 위 표시용)
  error: string | null
  startListening: () => void
  stopListening: () => void
}

// ── 헬퍼 ──────────────────────────────────────────────
function makeSpeechRecognition(): SpeechRecognition | null {
  const API = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!API) return null
  const r = new API()
  r.lang = STT_LANG
  r.interimResults = true   // 중간 결과도 transcript에 반영
  r.continuous = false
  return r
}

function speakText(text: string, onEnd: () => void): void {
  speechSynthesis.cancel()  // 이전 TTS 중단
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = TTS_LANG
  utterance.rate = TTS_RATE
  utterance.onend = onEnd   // 재생 완료 시 state → idle
  speechSynthesis.speak(utterance)
}

// ── 훅 ────────────────────────────────────────────────
export function useVoiceChat(seniorId: string): UseVoiceChatReturn {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const sequenceRef = useRef<number>(0)
  // sendToAI 클로저에서 최신 messages를 참조하기 위한 ref
  const messagesRef = useRef<ChatMessage[]>([])
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // useEffect 클린업에서 state를 읽기 위한 ref (클로저 stale 방지)
  const stateRef = useRef<VoiceChatState>('idle')

  const [state, setState] = useState<VoiceChatState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  // state 변경 시 ref도 동기화
  const updateState = useCallback((next: VoiceChatState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // messages 상태와 ref를 동기화
  const addMessage = useCallback((msg: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, msg]
    setMessages(messagesRef.current)
  }, [])

  // 대화 세션 생성 (최초 1회)
  const ensureConversation = useCallback(async () => {
    if (conversationIdRef.current) return
    const { data, error: dbErr } = await supabase
      .from('conversations')
      .insert({ senior_id: seniorId })
      .select('id')
      .single()
    if (dbErr) {
      console.error('[useVoiceChat] conversation 생성 실패', dbErr)
      return
    }
    conversationIdRef.current = data.id
  }, [seniorId])

  // utterance DB 저장
  const saveUtterance = useCallback(async (
    speaker: TablesInsert<'utterances'>['speaker'],
    content: string,
  ) => {
    if (!conversationIdRef.current) return
    const { error: dbErr } = await supabase.from('utterances').insert({
      conversation_id: conversationIdRef.current,
      speaker,
      content,
      sequence_number: sequenceRef.current++,
    })
    if (dbErr) console.error('[useVoiceChat] utterance 저장 실패', dbErr)
  }, [])

  // Edge Function 스트리밍 호출 + TTS 재생
  const sendToAI = useCallback(async (userText: string) => {
    updateState('processing')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('[useVoiceChat] 세션 없음')

      await ensureConversation()
      await saveUtterance('senior', userText)

      // 대화 맥락 전체를 Edge Function에 전달
      const history: VoiceChatMessage[] = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const stream = await streamVoiceChat(history, accessToken, seniorId)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accumulated,
        timestamp: new Date(),
      }
      addMessage(aiMsg)
      await saveUtterance('ai', accumulated)

      updateState('speaking')
      speakText(accumulated, () => updateState('idle'))
    } catch (err) {
      console.error('[useVoiceChat] AI 응답 실패', err)
      setError('응답을 받지 못했어요. 다시 시도해 주세요')
      updateState('idle')
    }
  }, [seniorId, ensureConversation, saveUtterance, addMessage, updateState])

  // SpeechRecognition 초기화 및 이벤트 핸들러 등록
  useEffect(() => {
    const recognition = makeSpeechRecognition()
    if (!recognition) {
      setError('이 브라우저는 음성 인식을 지원하지 않아요')
      return
    }

    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex]
      const text = result[0].transcript
      setTranscript(text)

      if (result.isFinal) {
        if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)
        setTranscript('')
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          timestamp: new Date(),
        }
        addMessage(userMsg)
        void sendToAI(text)
      }
    }

    recognition.onerror = (event) => {
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)

      // no-speech: 5초 후 자동 재시작 (TASK-09)
      if (event.error === 'no-speech') {
        noSpeechTimerRef.current = setTimeout(() => {
          if (stateRef.current === 'listening') recognition.start()
        }, NO_SPEECH_RESTART_MS)
        return
      }

      setError(STT_ERROR_MESSAGES[event.error] ?? '음성 인식에 실패했어요')
      updateState('idle')
    }

    recognition.onend = () => {
      // processing/speaking 중에는 상태를 유지한다
      setState((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      speechSynthesis.cancel()
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)
      // 페이지 이탈 시 대화 세션 종료 처리 (TASK-10)
      if (conversationIdRef.current) {
        void supabase
          .from('conversations')
          .update({
            ended_at: new Date().toISOString(),
            utterance_count: sequenceRef.current,
          })
          .eq('id', conversationIdRef.current)
      }
    }
  }, [addMessage, sendToAI, updateState])

  const startListening = useCallback(() => {
    if (stateRef.current !== 'idle') return
    speechSynthesis.cancel()
    setError(null)
    recognitionRef.current?.start()
    updateState('listening')
  }, [updateState])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    updateState('idle')
  }, [updateState])

  return { state, messages, transcript, error, startListening, stopListening }
}
