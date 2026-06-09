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

// TTS 기본값: senior_profiles 로드 완료 전까지 사용 (봄달, 속도 0=normal)
const DEFAULT_TTS_VOICE: TtsVoice = 'vara'
const DEFAULT_TTS_SPEED: TtsSpeed = 'normal'

// 문장 단위 TTS 조기 요청 최소 글자수 — 너무 짧은 segment는 다음 문장과 합산
const MIN_TTS_SEGMENT_LENGTH = 15

// ── 침묵 감지(VAD)·무음 가드 상수 (MediaRecorder 경로 전용) ──
// RMS(음량, 0~1) 기준. 실기기 실측으로 미세 조정 가능.
const SPEECH_RMS_THRESHOLD = 0.04   // 이 값을 한 번이라도 넘으면 '발화 시작'으로 판정
const SILENCE_DURATION_MS = 1800    // 발화 후 무음이 이만큼 지속되면 자동 종료·전송
const MAX_RECORDING_MS = 30000      // 최대 녹음 시간 (자동 종료 안전장치)
const MIN_RECORDING_MS = 600        // 이보다 짧은 녹음은 무음으로 간주 (환각 방지)
const VAD_TICK_MS = 100             // 음량 체크 주기

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
  analyser: AnalyserNode | null
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
  // 언마운트 여부 — cleanup 후 onerror/play().catch() 에서 Web TTS fallback 방지
  const unmountedRef = useRef(false)
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

  // 침묵 감지(VAD)·무음 가드용 Web Audio refs (MediaRecorder 경로 전용)
  const audioContextRef = useRef<AudioContext | null>(null)
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartRef = useRef<number>(0)   // 녹음 시작 시각 (길이·최대시간 판정)
  const lastSpeechAtRef = useRef<number>(0)      // 마지막으로 발화가 감지된 시각
  const speechDetectedRef = useRef<boolean>(false) // 녹음 중 발화가 있었는지 (무음 가드)
  const vadActiveRef = useRef<boolean>(false)       // AudioContext 지원 시에만 VAD·무음가드 활성

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
  // 녹음 중 파형 시각화용 AnalyserNode (listening 시작 시 set, 종료 시 null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const updateState = useCallback((next: VoiceChatState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const addMessage = useCallback((msg: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, msg]
    setMessages(messagesRef.current)
  }, [])

  // ── 침묵 감지(VAD) 시작 — MediaRecorder 스트림에 AnalyserNode 연결 ──
  // 1) analyser를 노출해 파형 시각화 (실시간 텍스트가 없는 Whisper batch의 대체 피드백)
  // 2) 발화 후 무음이 일정 시간 지속되면 자동으로 녹음 종료 → 마이크 재클릭 불필요
  // 3) 발화 자체가 없으면 onstop에서 STT를 건너뛰어 Whisper 환각 방지
  const startVad = useCallback((stream: MediaStream) => {
    recordingStartRef.current = Date.now()
    lastSpeechAtRef.current = Date.now()
    speechDetectedRef.current = false
    vadActiveRef.current = false

    // AudioContext 미지원(테스트 환경·구형 브라우저)이면 VAD·무음가드 없이 기존 동작 유지
    const Ctx = window.AudioContext
      ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    let audioCtx: AudioContext
    let analyserNode: AnalyserNode
    try {
      audioCtx = new Ctx()
      void audioCtx.resume()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 2048
      source.connect(analyserNode)
    } catch {
      // AudioContext 생성/연결 실패 → VAD 비활성 (무음 가드 스킵)
      vadActiveRef.current = false
      return
    }
    setAnalyser(analyserNode)
    vadActiveRef.current = true

    const vadData = new Uint8Array(analyserNode.fftSize)
    vadIntervalRef.current = setInterval(() => {
      analyserNode.getByteTimeDomainData(vadData)
      // RMS(음량) 계산 — 128 중앙 정규화 후 제곱평균제곱근
      let sumSq = 0
      for (let i = 0; i < vadData.length; i++) {
        const v = vadData[i] / 128 - 1
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / vadData.length)
      const now = Date.now()

      // 임계값을 한 번이라도 넘으면 '발화 시작' — 이후 침묵 종료 로직 활성화
      if (rms > SPEECH_RMS_THRESHOLD) {
        speechDetectedRef.current = true
        lastSpeechAtRef.current = now
      }
      // 최대 녹음 시간 초과 → 강제 종료 (안전장치)
      if (now - recordingStartRef.current >= MAX_RECORDING_MS) {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
        return
      }
      // 발화 후 무음이 SILENCE_DURATION_MS 지속 → 자동 종료·전송
      if (speechDetectedRef.current && now - lastSpeechAtRef.current >= SILENCE_DURATION_MS) {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      }
    }, VAD_TICK_MS)
  }, [])

  // VAD 정리 — interval·AudioContext 해제 및 analyser null화
  const stopVad = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = null
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAnalyser(null)
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
      // (cleanup이 핸들러를 먼저 분리하므로 src='' 비동기 onerror는 더 이상 이 경로를 타지 않음)
      audio.onerror = () => {
        revokeObjectUrl(blobUrl)
        currentBlobUrlRef.current = null
        if (unmountedRef.current) { resolve(); return }
        speakWithSpeechSynthesis(fallbackText, resolve)
      }

      audio.play().catch((err: unknown) => {
        // cleanup의 audio.pause() 호출은 pending play()를 AbortError로 reject시킴
        // → fallback 없이 조용히 resolve (Web TTS 트리거 차단)
        const errName = err instanceof Error ? err.name : ''
        if (errName === 'AbortError' || unmountedRef.current) {
          resolve()
          return
        }
        // autoplay 정책 등으로 play()가 throw해도 실제로는 재생 중일 수 있음
        // paused 상태가 아니면 이미 재생 중이므로 fallback 생략 (onended가 resolve 담당)
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
        // 언마운트 후에는 즉시 중단 — 뒤로가기 시 Web TTS fallback 트리거 방지
        if (unmountedRef.current) break
        let blobUrl: string | null = null
        try {
          blobUrl = await segment.promise
        } catch {
          // fetchTts 실패 → segment별 speechSynthesis fallback
        }
        // await 중에 언마운트됐을 경우 재확인 (fetch 응답 전 뒤로가기 시 이 경로로 탈출)
        if (unmountedRef.current) break
        if (blobUrl) {
          await playBlobAsync(blobUrl, segment.text)
        } else if (import.meta.env.VITE_TTS_DISABLED !== 'true') {
          // VITE_TTS_DISABLED=true 시 speechSynthesis도 스킵 — 헤드리스 환경에서 onend 미발화 방지
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
      // 인식이 끝났을 때 아직 listening이면 idle로 전환.
      // updateState로 stateRef까지 함께 갱신해야 한다 — 직접 setState만 쓰면
      // stateRef가 'listening'으로 남아 no-speech 재시작(stateRef 참조) 등 게이트 로직이 오동작한다.
      if (stateRef.current === 'listening') updateState('idle')
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current)
    }
  }, [addMessage, sendToAI, updateState])

  // 언마운트 시 전체 리소스 정리 + 대화 세션 종료 처리
  useEffect(() => {
    // StrictMode 호환: dev mode에서 마운트 직후 cleanup이 한 번 시뮬레이션 실행되며
    // unmountedRef.current = true로 고정되어 정상 동작 중에도 sendToAI 루프가 즉시 break되는 문제 방지
    // (useRef 값은 시뮬레이션 재마운트에서도 리셋되지 않으므로 setup body에서 명시적으로 false 처리)
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      // 마이크 트랙 해제
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      // VAD(AudioContext·interval) 정리 — 언마운트 중이므로 setAnalyser는 생략
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current)
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
      // <audio> 재생 중단 및 Blob URL 정리
      // 핸들러를 먼저 분리해야 src='' 가 비동기 onerror로 Web TTS fallback을 트리거하지 않음
      if (audioRef.current) {
        audioRef.current.onended = null
        audioRef.current.onerror = null
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
        // 음량 모니터링 시작 — 파형 표시 + 자동 종료 + 무음 가드
        startVad(stream)
        const mimeType = getSupportedMimeType()
        mimeTypeRef.current = mimeType
        const recorderOptions = mimeType ? { mimeType } : undefined
        const recorder = new MediaRecorder(stream, recorderOptions)

        audioChunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.onstop = () => {
          // VAD 정리(analyser 해제 포함) + 마이크 트랙 즉시 해제
          stopVad()
          stream.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
          const blob = new Blob(audioChunksRef.current, {
            type: mimeTypeRef.current || 'audio/webm',
          })
          audioChunksRef.current = []

          // 무음 가드: VAD가 활성일 때만, 발화 없음/너무 짧은 녹음이면 STT 건너뜀 (Whisper 환각 방지)
          // AudioContext 미지원 환경에서는 가드를 적용하지 않고 기존 동작(항상 STT) 유지
          const durationMs = Date.now() - recordingStartRef.current
          if (vadActiveRef.current && (!speechDetectedRef.current || durationMs < MIN_RECORDING_MS)) {
            setError('말씀이 인식되지 않았어요. 다시 시도해 주세요')
            updateState('idle')
            return
          }

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
  }, [updateState, processRecordedAudio, startVad, stopVad])

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
    analyser,
  }
}
