// STT(MediaRecorder + stt-whisper) → LLM 스트리밍 → TTS(tts-openai + <audio>) 전체 흐름 조율 훅
// MediaRecorder 미지원 브라우저(구형 iOS Safari 등)에서는 Web Speech API로 자동 폴백

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { streamVoiceChat, type VoiceChatMessage } from '@/lib/ai/voiceChatClient'
import { uploadAudio, getSupportedMimeType } from '@/lib/ai/sttWhisperClient'
import { fetchTts, revokeObjectUrl } from '@/lib/ai/ttsClovaClient'
import type { TablesInsert } from '@/types/database'
import type { TtsVoice, TtsSpeed } from '@/types/domain'

// ── 상수 ──────────────────────────────────────────────
const STT_LANG = 'ko-KR'
const TTS_LANG = 'ko-KR'
const TTS_RATE = 0.9
// no-speech 감지 후 자동 재시작 대기 (Web Speech 폴백 경로 전용)
const NO_SPEECH_RESTART_MS = 5000
// STT no-speech 에러가 이 횟수를 초과하면 자동 복구 중단
const MAX_STT_RETRY_COUNT = 3
// Edge Function 스트리밍 응답 대기 최대 시간 (ms)
const EDGE_FUNCTION_TIMEOUT_MS = 15000
const FATAL_ERROR_MSG = '연결할 수 없어요. 아래 버튼을 눌러 다시 시도해 주세요'

// TTS 기본값: senior_profiles 로드 완료 전까지 사용
// Phase 1: ngoeun 1종 운영. Phase 2 확장 시 사용자 선택값으로만 변경됨 (DEFAULT는 그대로 유지)
const DEFAULT_TTS_VOICE: TtsVoice = 'ngoeun'
const DEFAULT_TTS_SPEED: TtsSpeed = 'slow'

// 문장 단위 TTS 조기 요청 최소 글자수 — 너무 짧은 segment는 다음 문장과 합산
const MIN_TTS_SEGMENT_LENGTH = 15

// STT 지원 여부: MediaRecorder 또는 Web Speech API 중 하나라도 지원하면 true
const isSttSupported =
  typeof window !== 'undefined' &&
  (typeof MediaRecorder !== 'undefined' ||
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition))

const STT_ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 사용 권한이 필요해요',
  'no-speech': '말씀이 인식되지 않았어요. 다시 시도해 주세요',
  'network': '네트워크 연결을 확인해 주세요',
  'audio-capture': '마이크를 찾을 수 없어요',
}

// ── 타입 ──────────────────────────────────────────────
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
  transcript: string
  error: string | null
  isSttSupported: boolean
  isFatalError: boolean
  startListening: () => void
  stopListening: () => void
  sendTextMessage: (text: string) => Promise<void>
  retryFromFatal: () => void
}

// ── 헬퍼 ──────────────────────────────────────────────

// Web Speech SpeechRecognition 생성 (MediaRecorder 미지원 브라우저 폴백 및 STT 2차 폴백용)
function makeSpeechRecognition(): SpeechRecognition | null {
  const API = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!API) return null
  const r = new API()
  r.lang = STT_LANG
  r.interimResults = true
  r.continuous = false
  return r
}

// Web Speech TTS (tts-openai 실패 시 폴백)
function speakWithSpeechSynthesis(text: string, onEnd: () => void): void {
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = TTS_LANG
  utterance.rate = TTS_RATE
  utterance.onend = onEnd
  speechSynthesis.speak(utterance)
}

// Web Speech STT를 단일 시도 Promise로 래핑 (MediaRecorder STT 실패 시 2차 폴백)
function transcribeWithWebSpeech(): Promise<string> {
  return new Promise((resolve, reject) => {
    const recognition = makeSpeechRecognition()
    if (!recognition) {
      reject(new Error('Web Speech API가 지원되지 않습니다'))
      return
    }
    // 폴백 시도: interimResults 불필요
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? ''
      if (text.trim()) resolve(text.trim())
      else reject(new Error('음성 인식 결과 없음'))
    }
    recognition.onerror = (e) => reject(new Error(e.error))
    recognition.onend = () => {} // onresult 또는 onerror에서 처리
    recognition.start()
  })
}

// ── 훅 ────────────────────────────────────────────────
export function useVoiceChat(seniorId: string): UseVoiceChatReturn {
  // Web Speech 경로 전용 ref (MediaRecorder 미지원 브라우저 + STT 2차 폴백)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const sequenceRef = useRef<number>(0)
  const messagesRef = useRef<ChatMessage[]>([])
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<VoiceChatState>('idle')
  const retryCountRef = useRef<number>(0)
  // cleanup은 async 불가 → 최신 세션 토큰을 ref에 캐시
  const accessTokenRef = useRef<string | null>(null)

  // MediaRecorder 기반 STT refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef<string>('')

  // TTS 재생용 <audio> 엘리먼트 및 Blob URL (volume=1.0 기본값, 디바이스 시스템 볼륨 위임)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentBlobUrlRef = useRef<string | null>(null)

  // senior_profiles TTS 설정 캐시 — 마운트 시 1회 로드로 매 TTS 호출마다 DB 조회 방지
  const ttsVoiceRef = useRef<TtsVoice>(DEFAULT_TTS_VOICE)
  const ttsSpeedRef = useRef<TtsSpeed>(DEFAULT_TTS_SPEED)

  const [state, setState] = useState<VoiceChatState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFatalError, setIsFatalError] = useState<boolean>(false)

  const updateState = useCallback((next: VoiceChatState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const addMessage = useCallback((msg: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, msg]
    setMessages(messagesRef.current)
  }, [])

  // 마운트 시 senior_profiles TTS 설정 1회 로드 → ref에 캐시
  // sendToAI 내부에서 매 TTS 호출마다 DB 조회하지 않도록 사전 캐시
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('senior_profiles')
        .select('tts_voice, tts_speed')
        .eq('id', seniorId)
        .single()
      if (data) {
        ttsVoiceRef.current = data.tts_voice as TtsVoice
        ttsSpeedRef.current = data.tts_speed as TtsSpeed
      }
    })()
  }, [seniorId])

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

  // blob URL 하나를 재생하는 Promise 기반 헬퍼
  // — 재생 완료·실패 모두 resolve (reject 없음, 실패는 speechSynthesis fallback으로 처리)
  // — 분리 이유: sendToAI에서 segment별로 await하며 순서 보장 필요
  const playBlobAsync = useCallback((blobUrl: string, fallbackText: string): Promise<void> => {
    return new Promise((resolve) => {
      if (currentBlobUrlRef.current) revokeObjectUrl(currentBlobUrlRef.current)
      currentBlobUrlRef.current = blobUrl

      if (!audioRef.current) audioRef.current = new Audio()
      const audio = audioRef.current
      audio.src = blobUrl

      audio.onended = () => {
        revokeObjectUrl(blobUrl)
        currentBlobUrlRef.current = null
        resolve()
      }
      // <audio> 로드·디코드 실패 → speechSynthesis fallback 후 resolve
      audio.onerror = () => {
        revokeObjectUrl(blobUrl)
        currentBlobUrlRef.current = null
        speakWithSpeechSynthesis(fallbackText, resolve)
      }

      audio.play().catch(() => {
        // autoplay 정책 등으로 play()가 throw해도 실제로는 재생 중일 수 있음
        // paused 상태가 아니면 이미 재생 중이므로 fallback 생략
        if (audio.paused) {
          revokeObjectUrl(blobUrl)
          currentBlobUrlRef.current = null
          speakWithSpeechSynthesis(fallbackText, resolve)
        }
      })
    })
  }, [])

  // Edge Function 스트리밍 호출 + TTS 재생
  const sendToAI = useCallback(async (userText: string) => {
    updateState('processing')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('[useVoiceChat] 세션 없음')
      accessTokenRef.current = accessToken

      await ensureConversation()
      await saveUtterance('senior', userText)

      const history: VoiceChatMessage[] = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const stream = await streamVoiceChat(history, accessToken, seniorId, controller.signal)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      // 스트리밍 중 문장 단위 TTS 선발행 — LLM 스트리밍과 TTS fetch를 병렬로 실행
      // 각 segment: { text, promise } — promise는 fetchTts 호출 즉시 시작됨
      const ttsSegments: Array<{ text: string; promise: Promise<string> }> = []
      let pendingSegment = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE 라인 단위 파싱 — "data: {...}" 에서 text-delta만 추출
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw) as { type: string; delta?: string }
            if (parsed.type === 'text-delta' && parsed.delta) {
              accumulated += parsed.delta
              pendingSegment += parsed.delta

              // 충분한 길이(≥ MIN_TTS_SEGMENT_LENGTH)의 문장 끝을 찾아 즉시 TTS 선발행
              // 짧은 경계("네!")는 건너뛰고 다음 경계(".")까지 합산 (global regex로 순회)
              const re = /[.!?。！？…]+(?:\s|$)/g
              let m: RegExpExecArray | null
              while ((m = re.exec(pendingSegment)) !== null) {
                const endIdx = m.index + m[0].length
                if (endIdx >= MIN_TTS_SEGMENT_LENGTH) {
                  const segment = pendingSegment.slice(0, endIdx).trim()
                  ttsSegments.push({
                    text: segment,
                    promise: fetchTts(segment, ttsVoiceRef.current, ttsSpeedRef.current, accessToken),
                  })
                  pendingSegment = pendingSegment.slice(endIdx)
                  break
                }
              }
            }
          } catch {
            // JSON 파싱 실패 라인은 무시
          }
        }
      }

      // 스트리밍 완료 후 남은 텍스트 처리
      // ttsSegments가 비어 있으면(문장 끝 없이 짧은 응답) accumulated 전체를 단일 segment로
      const remaining = (ttsSegments.length === 0 ? accumulated : pendingSegment).trim()
      if (remaining.length > 0) {
        ttsSegments.push({
          text: remaining,
          promise: fetchTts(remaining, ttsVoiceRef.current, ttsSpeedRef.current, accessToken),
        })
      }

      clearTimeout(timeoutId)
      retryCountRef.current = 0

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accumulated,
        timestamp: new Date(),
      }
      addMessage(aiMsg)
      // DB 저장과 TTS 재생을 병렬로 — saveUtterance 완료를 TTS가 기다릴 필요 없음
      void saveUtterance('ai', accumulated)

      updateState('speaking')

      // TTS segment를 순서대로 재생 (fetch는 이미 스트리밍 중에 시작됨)
      for (const segment of ttsSegments) {
        let blobUrl: string | null = null
        try {
          blobUrl = await segment.promise
        } catch {
          // fetchTts 실패 → segment별 speechSynthesis fallback
        }
        if (blobUrl) {
          await playBlobAsync(blobUrl, segment.text)
        } else {
          await new Promise<void>((resolve) => speakWithSpeechSynthesis(segment.text, resolve))
        }
      }

      updateState('idle')
    } catch (err) {
      clearTimeout(timeoutId)
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      console.error('[useVoiceChat] AI 응답 실패', err)
      setError(isTimeout ? '응답 시간이 초과됐어요. 다시 시도해 주세요' : FATAL_ERROR_MSG)
      if (!isTimeout) setIsFatalError(true)
      updateState('idle')
    }
  }, [seniorId, ensureConversation, saveUtterance, addMessage, updateState, playBlobAsync])

  // MediaRecorder로 녹음된 Blob → stt-whisper STT → sendToAI
  // STT 1차 실패 시 Web Speech SpeechRecognition 단일 재시도
  const processRecordedAudio = useCallback(async (blob: Blob) => {
    updateState('processing')

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setError(FATAL_ERROR_MSG)
      setIsFatalError(true)
      updateState('idle')
      return
    }
    accessTokenRef.current = accessToken

    let text = ''
    try {
      const result = await uploadAudio(blob, seniorId, accessToken)
      text = result.text
    } catch {
      // STT 1차 실패 → Web Speech 단일 재시도
      setTranscript('잠시 다른 방법으로 듣고 있어요')
      try {
        text = await transcribeWithWebSpeech()
      } catch {
        setTranscript('')
        setError('음성이 잘 들리지 않아요. 글로 입력해 주세요')
        updateState('idle')
        return
      }
    }

    setTranscript('')
    if (!text.trim()) {
      setError('말씀이 인식되지 않았어요. 다시 시도해 주세요')
      updateState('idle')
      return
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    addMessage(userMsg)
    void sendToAI(text.trim())
  }, [seniorId, addMessage, sendToAI, updateState])

  // Web Speech 경로 이벤트 핸들러 초기화
  // MediaRecorder 미지원 브라우저에서만 recognition을 생성·사용
  useEffect(() => {
    // MediaRecorder가 지원되면 Web Speech 초기화 불필요
    if (typeof MediaRecorder !== 'undefined') return

    const recognition = makeSpeechRecognition()
    if (!recognition) return

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

      if (event.error === 'no-speech') {
        retryCountRef.current += 1
        if (retryCountRef.current >= MAX_STT_RETRY_COUNT) {
          setIsFatalError(true)
          setError(FATAL_ERROR_MSG)
          updateState('idle')
          return
        }
        noSpeechTimerRef.current = setTimeout(() => {
          if (stateRef.current === 'listening') recognition.start()
        }, NO_SPEECH_RESTART_MS)
        return
      }

      setError(STT_ERROR_MESSAGES[event.error] ?? '음성 인식에 실패했어요')
      updateState('idle')
    }

    recognition.onend = () => {
      setState((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)
    }
  }, [addMessage, sendToAI, updateState])

  // 언마운트 시 전체 리소스 정리 + 대화 세션 종료 처리
  useEffect(() => {
    return () => {
      // 마이크 트랙 해제
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      // <audio> 재생 중단 및 Blob URL 정리
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      if (currentBlobUrlRef.current) {
        revokeObjectUrl(currentBlobUrlRef.current)
        currentBlobUrlRef.current = null
      }
      speechSynthesis.cancel()
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)

      // 페이지 이탈 시 대화 세션 종료 처리
      const conversationId = conversationIdRef.current
      // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup 시점의 최신 sequence 값이 필요하므로 의도적으로 ref.current 직접 참조
      const utteranceCount = sequenceRef.current
      if (conversationId) {
        void supabase
          .from('conversations')
          .update({
            ended_at: new Date().toISOString(),
            utterance_count: utteranceCount,
          })
          .eq('id', conversationId)

        const token = accessTokenRef.current
        if (token) {
          // 세션 종료 후 메모리 추출 (keepalive — 페이지 이탈 후에도 완료 보장)
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-memory`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ conversation_id: conversationId, senior_id: seniorId }),
              keepalive: true,
            },
          ).catch((err) => console.error('[useVoiceChat] extract-memory 호출 실패', err))

          // 세션 종료 후 발화 태그 분류 (keepalive)
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tag-utterances`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ conversation_id: conversationId, senior_id: seniorId }),
              keepalive: true,
            },
          ).catch((err) => console.error('[useVoiceChat] tag-utterances 호출 실패', err))
        }
      }
    }
  }, [seniorId])

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim()) return
    const cur = stateRef.current
    if (cur === 'processing') return
    if (cur === 'speaking') {
      audioRef.current?.pause()
      speechSynthesis.cancel()
      updateState('idle')
    }
    setError(null)
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    addMessage(userMsg)
    await sendToAI(text.trim())
  }, [addMessage, sendToAI, updateState])

  const retryFromFatal = useCallback(() => {
    setIsFatalError(false)
    setError(null)
    retryCountRef.current = 0
  }, [])

  const startListening = useCallback(() => {
    const cur = stateRef.current
    if (cur === 'processing') return
    if (cur !== 'idle' && cur !== 'speaking') return

    if (cur === 'speaking') {
      audioRef.current?.pause()
      speechSynthesis.cancel()
    }

    setError(null)

    // MediaRecorder 미지원 → Web Speech API 경로 (recognitionRef에 설정된 handlers 사용)
    if (typeof MediaRecorder === 'undefined') {
      speechSynthesis.cancel()
      recognitionRef.current?.start()
      updateState('listening')
      return
    }

    // MediaRecorder 기반 녹음 시작
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream
        const mimeType = getSupportedMimeType()
        mimeTypeRef.current = mimeType
        const recorderOptions = mimeType ? { mimeType } : undefined
        const recorder = new MediaRecorder(stream, recorderOptions)

        audioChunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.onstop = () => {
          // 마이크 트랙 즉시 해제
          stream.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          const blob = new Blob(audioChunksRef.current, {
            type: mimeTypeRef.current || 'audio/webm',
          })
          audioChunksRef.current = []
          void processRecordedAudio(blob)
        }

        mediaRecorderRef.current = recorder
        recorder.start()
        updateState('listening')
      })
      .catch((err) => {
        const errName = err instanceof Error ? err.name : ''
        setError(
          errName === 'NotAllowedError'
            ? STT_ERROR_MESSAGES['not-allowed']
            : STT_ERROR_MESSAGES['audio-capture'],
        )
        updateState('idle')
      })
  }, [updateState, processRecordedAudio])

  const stopListening = useCallback(() => {
    if (stateRef.current !== 'listening') return

    if (mediaRecorderRef.current?.state === 'recording') {
      // MediaRecorder 경로: stop() → onstop → processRecordedAudio → state: processing
      mediaRecorderRef.current.stop()
    } else {
      // Web Speech 경로: stop() → recognition.onend → state: idle
      recognitionRef.current?.stop()
      updateState('idle')
    }
  }, [updateState])

  return {
    state,
    messages,
    transcript,
    error,
    isSttSupported,
    isFatalError,
    startListening,
    stopListening,
    sendTextMessage,
    retryFromFatal,
  }
}
