import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type VoiceReplyState = 'idle' | 'recording' | 'uploading'

interface UseVoiceReplyOptions {
  seniorId: string
  onTranscript?: (text: string) => void
}

export function useVoiceReply({ seniorId, onTranscript }: UseVoiceReplyOptions) {
  const [state, setState] = useState<VoiceReplyState>('idle')
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start()
      mediaRecorderRef.current = recorder

      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)

      // Web Speech API STT (best-effort, 브라우저 지원 시)
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
          .webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.lang = 'ko-KR'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results).map((r) => r[0].transcript).join('')
          onTranscript?.(transcript)
        }
        recognition.start()
        recognitionRef.current = recognition
      }

      setState('recording')
      return true
    } catch {
      return false
    }
  }, [onTranscript])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

      const recorder = mediaRecorderRef.current
      if (!recorder) { setState('idle'); resolve(null); return }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        setState('idle')
        resolve(blob)
      }
      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
      mediaRecorderRef.current = null
    })
  }, [])

  const uploadReply = useCallback(async (
    commentId: string,
    blob: Blob,
    textContent: string,
  ): Promise<{ error: Error | null }> => {
    setState('uploading')
    try {
      // 1. reply INSERT → auto-generated UUID 수령
      const { data: replyData, error: insertError } = await supabase
        .from('replies')
        .insert({ comment_id: commentId, senior_id: seniorId, content: textContent })
        .select('id')
        .single()
      if (insertError || !replyData) throw insertError ?? new Error('INSERT 실패')

      // 2. Storage 업로드
      const path = `${seniorId}/${replyData.id}.webm`
      const { error: uploadError } = await supabase.storage
        .from('reply-audio')
        .upload(path, blob, { contentType: 'audio/webm', upsert: false })

      // 3. audio_url 반영 (업로드 실패해도 텍스트 답장은 유지)
      if (!uploadError) {
        await supabase.from('replies').update({ audio_url: path }).eq('id', replyData.id)
      }

      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) }
    } finally {
      setState('idle')
    }
  }, [seniorId])

  // audio_url = 스토리지 경로 (예: "{senior_id}/{reply_id}.webm")
  const getSignedUrl = useCallback(async (audioPath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('reply-audio')
      .createSignedUrl(audioPath, 3600)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }, [])

  return { state, duration, startRecording, stopRecording, uploadReply, getSignedUrl }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
